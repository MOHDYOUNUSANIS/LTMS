import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
    chemicalName: '',
    chemicalCode: '',
    category: '',
    unit: 'KG',
    openingStock: '0',
    minimumStock: '0',
    storageLocation: '',
    supplier: ''
};

export default function Inventory() {
    const [companies, setCompanies] = useState([]);
    const [companyId, setCompanyId] = useState('');
    const [rows, setRows] = useState([]);
    const lowStockRows = rows.filter(
        r => r.is_active && Number(r.current_stock) <= Number(r.minimum_stock)
    );
    const [form, setForm] = useState(emptyForm);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [selectedChemical, setSelectedChemical] = useState(null);
    const [movements, setMovements] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [editingChemical, setEditingChemical] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [editLoading, setEditLoading] = useState(false);
    const [movementChemical, setMovementChemical] = useState(null);
    const [movementType, setMovementType] = useState('');
    const [movementQuantity, setMovementQuantity] = useState('');
    const [movementNote, setMovementNote] = useState('');
    const [movementLoading, setMovementLoading] = useState(false);

    async function loadCompanies() {
        try {
            const data = await api('/companies');
            const activeCompanies = data.filter(company => company.is_active);
            setCompanies(activeCompanies);

            if (activeCompanies.length && !companyId) {
                setCompanyId(String(activeCompanies[0].id));
            }
        } catch (e) {
            setError(e.message);
        }
    }

    async function loadChemicals(id) {
        if (!id) {
            setRows([]);
            return;
        }

        try {
            setLoading(true);
            setRows(await api(`/chemicals?companyId=${id}&includeInactive=true`));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function viewHistory(chemical) {
        setSelectedChemical(chemical);
        setMovements([]);
        setHistoryLoading(true);
        setError('');

        try {
            const data = await api(`/chemicals/${chemical.id}/movements`);
            setMovements(data.movements);
        } catch (e) {
            setError(e.message);
        } finally {
            setHistoryLoading(false);
        }
    }

    useEffect(() => {
        loadCompanies();
    }, []);

    useEffect(() => {
        loadChemicals(companyId);
    }, [companyId]);

    function change(e) {
        setForm({ ...form, [e.target.name]: e.target.value });
    }
    function startEdit(chemical) {
        setEditingChemical(chemical);

        setEditForm({
            chemicalCode: chemical.chemical_code || '',
            chemicalName: chemical.chemical_name || '',
            category: chemical.category || '',
            unit: chemical.unit || 'KG',
            minimumStock: String(chemical.minimum_stock ?? 0),
            storageLocation: chemical.storage_location || '',
            supplier: chemical.supplier || ''
        });
    }

    function changeEdit(e) {
        setEditForm({
            ...editForm,
            [e.target.name]: e.target.value
        });
    }
    async function saveEdit(e) {
        e.preventDefault();
        setError('');
        setSuccess('');
        setEditLoading(true);

        try {
            await api(`/chemicals/${editingChemical.id}`, {
                method: 'PUT',
                body: JSON.stringify(editForm)
            });

            setSuccess('Chemical details updated successfully.');
            setEditingChemical(null);
            setEditForm({});
            await loadChemicals(companyId);
        } catch (err) {
            setError(err.message);
        } finally {
            setEditLoading(false);
        }
    }
    async function toggleChemicalStatus(chemical) {
        const newStatus = !chemical.is_active;

        const action = newStatus ? 'activate' : 'deactivate';

        if (!window.confirm(`Are you sure you want to ${action} ${chemical.chemical_name}?`)) {
            return;
        }

        setError('');
        setSuccess('');

        try {
            await api(`/chemicals/${chemical.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ isActive: newStatus })
            });

            setSuccess(`Chemical ${action}d successfully.`);
            await loadChemicals(companyId);
        } catch (err) {
            setError(err.message);
        }
    }
    async function submitStockReceipt(e) {
        e.preventDefault();

        setError('');
        setSuccess('');

        if (!movementChemical || Number(movementQuantity) <= 0) {
            setError('Please enter a valid receipt quantity.');
            return;
        }

        setMovementLoading(true);

        try {
            await api(`/chemicals/${movementChemical.id}/receipt`, {
                method: 'POST',
                body: JSON.stringify({
                    quantity: Number(movementQuantity),
                    referenceNote: movementNote.trim() || 'Stock receipt'
                })
            });

            setSuccess('Stock received successfully.');

            setMovementChemical(null);
            setMovementType('');
            setMovementQuantity('');
            setMovementNote('');

            await loadChemicals(companyId);
        } catch (err) {
            setError(err.message);
        } finally {
            setMovementLoading(false);
        }
    }
    async function submitStockIssue(e) {
        e.preventDefault();

        setError('');
        setSuccess('');

        if (!movementChemical || Number(movementQuantity) <= 0) {
            setError('Please enter a valid issue quantity.');
            return;
        }

        setMovementLoading(true);

        try {
            await api(`/chemicals/${movementChemical.id}/issue`, {
                method: 'POST',
                body: JSON.stringify({
                    quantity: Number(movementQuantity),
                    referenceNote: movementNote.trim() || 'Stock issue'
                })
            });

            setSuccess('Chemical stock issued successfully.');

            setMovementChemical(null);
            setMovementType('');
            setMovementQuantity('');
            setMovementNote('');

            await loadChemicals(companyId);
        } catch (err) {
            setError(err.message);
        } finally {
            setMovementLoading(false);
        }
    }

    function cancelEdit() {
        setEditingChemical(null);
        setEditForm({});
    }

    async function add(e) {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!companyId) {
            setError('Please select a company.');
            return;
        }

        try {
            await api('/chemicals', {
                method: 'POST',
                body: JSON.stringify({
                    ...form,
                    companyId: Number(companyId)
                })
            });

            setForm(emptyForm);
            setSuccess('Chemical added successfully.');
            await loadChemicals(companyId);
        } catch (e) {
            setError(e.message);
        }
    }

    return (
        <>
            <div className="page-heading">
                <div>
                    <h2>Chemical inventory</h2>
                    <p>Manage company-wise chemical stock and inventory.</p>
                </div>
            </div>
            <section className="panel">
                <div className="panel-head">
                    <h3>Low Stock Alerts</h3>
                    <strong>
                        {lowStockRows.length} Chemical(s) Need Attention
                    </strong>
                </div>

                {lowStockRows.length > 0 ? (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Chemical</th>
                                    <th>Current Stock</th>
                                    <th>Minimum Stock</th>
                                    <th>Unit</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {lowStockRows.map(r => (
                                    <tr key={r.id}>
                                        <td>{r.chemical_name}</td>
                                        <td>{r.current_stock}</td>
                                        <td>{r.minimum_stock}</td>
                                        <td>{r.unit}</td>
                                        <td>
                                            <span className="badge danger">
                                                Low Stock
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>All active chemicals are above their minimum stock levels.</p>
                )}
            </section>

            <section className="panel form-panel">
                <h3>Select company</h3>

                <select
                    value={companyId}
                    onChange={e => setCompanyId(e.target.value)}
                >
                    <option value="">Select a company</option>
                    {companies.map(company => (
                        <option key={company.id} value={company.id}>
                            {company.company_name}
                        </option>
                    ))}
                </select>

                {!companies.length && (
                    <p className="error">
                        No active companies found. Add or activate a company first.
                    </p>
                )}
            </section>

            <section className="panel form-panel">
                <h3>Add chemical</h3>

                <form className="inventory-form" onSubmit={add}>
                    <div>
                        <label>Chemical name *</label>
                        <input
                            name="chemicalName"
                            value={form.chemicalName}
                            onChange={change}
                            required
                            placeholder="e.g. Formic Acid"
                        />
                    </div>

                    <div>
                        <label>Chemical code *</label>
                        <input
                            name="chemicalCode"
                            value={form.chemicalCode}
                            onChange={change}
                            required
                            placeholder="CHEM-001"
                        />
                    </div>

                    <div>
                        <label>Category</label>
                        <input
                            name="category"
                            value={form.category}
                            onChange={change}
                            placeholder="Retanning / Dyeing"
                        />
                    </div>

                    <div>
                        <label>Unit</label>
                        <select name="unit" value={form.unit} onChange={change}>
                            <option value="KG">KG</option>
                            <option value="LITRE">LITRE</option>
                            <option value="PCS">PCS</option>
                        </select>
                    </div>

                    <div>
                        <label>Opening stock</label>
                        <input
                            type="number"
                            min="0"
                            step="0.001"
                            name="openingStock"
                            value={form.openingStock}
                            onChange={change}
                        />
                    </div>

                    <div>
                        <label>Minimum stock</label>
                        <input
                            type="number"
                            min="0"
                            step="0.001"
                            name="minimumStock"
                            value={form.minimumStock}
                            onChange={change}
                        />
                    </div>

                    <div>
                        <label>Storage location</label>
                        <input
                            name="storageLocation"
                            value={form.storageLocation}
                            onChange={change}
                            placeholder="Chemical store"
                        />
                    </div>

                    <div>
                        <label>Supplier</label>
                        <input
                            name="supplier"
                            value={form.supplier}
                            onChange={change}
                            placeholder="Supplier name"
                        />
                    </div>

                    <button className="primary" disabled={!companyId}>
                        + Save chemical
                    </button>
                </form>

                {error && <p className="error">{error}</p>}
                {success && <p className="success">{success}</p>}
            </section>

            <section className="panel table-panel">
                <div className="panel-head">
                    <h3>Stock register</h3>
                    <span className="tag">{rows.length} ITEMS</span>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Chemical</th>
                                <th>Category</th>
                                <th>Available</th>
                                <th>Minimum</th>
                                <th>Storage</th>
                                <th>Stock status</th>
                                <th>Account status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map(r => (
                                <tr key={r.id}>
                                    <td>
                                        <b>{r.chemical_name}</b>
                                        <small className="cell-sub">
                                            {r.chemical_code}
                                        </small>
                                    </td>

                                    <td>{r.category || '—'}</td>
                                    <td>{Number(r.current_stock).toFixed(3)} {r.unit}</td>
                                    <td>{Number(r.minimum_stock).toFixed(3)} {r.unit}</td>
                                    <td>{r.storage_location || '—'}</td>

                                    <td>
                                        {r.low_stock ? (
                                            <span className="low-pill">Low stock</span>
                                        ) : (
                                            <span className="status-text">In stock</span>
                                        )}
                                    </td>
                                    <td>
                                        {r.is_active ? 'Active' : 'Inactive'}
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            onClick={() => startEdit(r)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMovementChemical(r);
                                                setMovementType('RECEIPT');
                                                setMovementQuantity('');
                                                setMovementNote('');
                                                setError('');
                                                setSuccess('');
                                            }}
                                        >
                                            Receive Stock
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMovementChemical(r);
                                                setMovementType('ISSUE');
                                                setMovementQuantity('');
                                                setMovementNote('');
                                                setError('');
                                                setSuccess('');
                                            }}
                                        >
                                            Issue Stock
                                        </button>
                                        <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => viewHistory(r)}
                                        >
                                            View History
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => toggleChemicalStatus(r)}
                                        >
                                            {r.is_active ? 'Deactivate' : 'Activate'}
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {!loading && !rows.length && (
                                <tr>
                                    <td colSpan="8" className="empty">
                                        No chemical records for this company.
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td colSpan="8" className="empty">
                                        Loading chemicals...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
            {movementChemical && movementType === 'RECEIPT' && (
                <section className="panel form-panel">
                    <h3>Receive Chemical Stock</h3>

                    <p>
                        Chemical: <strong>{movementChemical.chemical_name}</strong>
                    </p>

                    <p>
                        Current Stock: {movementChemical.current_stock} {movementChemical.unit}
                    </p>

                    <form className="inventory-form" onSubmit={submitStockReceipt}>
                        <div>
                            <label>Received Quantity ({movementChemical.unit}) *</label>
                            <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                value={movementQuantity}
                                onChange={e => setMovementQuantity(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label>Reference / Purchase Note</label>
                            <input
                                type="text"
                                value={movementNote}
                                onChange={e => setMovementNote(e.target.value)}
                                placeholder="e.g. Purchase invoice number"
                            />
                        </div>

                        <button className="primary" type="submit" disabled={movementLoading}>
                            {movementLoading ? 'Processing...' : 'Confirm Receipt'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setMovementChemical(null);
                                setMovementType('');
                            }}
                        >
                            Cancel
                        </button>
                    </form>
                </section>
            )}
            {movementChemical && movementType === 'ISSUE' && (
                <section className="panel form-panel">
                    <h3>Issue Chemical Stock</h3>

                    <p>
                        Chemical: <strong>{movementChemical.chemical_name}</strong>
                    </p>

                    <p>
                        Available Stock: {movementChemical.current_stock} {movementChemical.unit}
                    </p>

                    <form className="inventory-form" onSubmit={submitStockIssue}>
                        <div>
                            <label>Quantity Issued ({movementChemical.unit}) *</label>
                            <input
                                type="number"
                                min="0.001"
                                step="0.001"
                                max={movementChemical.current_stock}
                                value={movementQuantity}
                                onChange={e => setMovementQuantity(e.target.value)}
                                required
                            />
                        </div>

                        <div>
                            <label>Production / Batch Reference</label>
                            <input
                                type="text"
                                value={movementNote}
                                onChange={e => setMovementNote(e.target.value)}
                                placeholder="e.g. Production Batch 001"
                            />
                        </div>

                        <button className="primary" type="submit" disabled={movementLoading}>
                            {movementLoading ? 'Processing...' : 'Confirm Issue'}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setMovementChemical(null);
                                setMovementType('');
                            }}
                        >
                            Cancel
                        </button>
                    </form>
                </section>
            )}
            {editingChemical && (
                <section className="panel">
                    <h2>Edit Chemical</h2>

                    <form onSubmit={saveEdit}>
                        <label>Chemical Code</label>
                        <input
                            name="chemicalCode"
                            value={editForm.chemicalCode}
                            onChange={changeEdit}
                            required
                        />

                        <label>Chemical Name</label>
                        <input
                            name="chemicalName"
                            value={editForm.chemicalName}
                            onChange={changeEdit}
                            required
                        />

                        <label>Category</label>
                        <input
                            name="category"
                            value={editForm.category}
                            onChange={changeEdit}
                        />

                        <label>Unit</label>
                        <select
                            name="unit"
                            value={editForm.unit}
                            onChange={changeEdit}
                            required
                        >
                            <option value="KG">KG</option>
                            <option value="LITRE">LITRE</option>
                            <option value="PCS">PCS</option>
                        </select>

                        <label>Minimum Stock</label>
                        <input
                            type="number"
                            min="0"
                            step="0.001"
                            name="minimumStock"
                            value={editForm.minimumStock}
                            onChange={changeEdit}
                            required
                        />

                        <label>Storage Location</label>
                        <input
                            name="storageLocation"
                            value={editForm.storageLocation}
                            onChange={changeEdit}
                        />

                        <label>Supplier</label>
                        <input
                            name="supplier"
                            value={editForm.supplier}
                            onChange={changeEdit}
                        />

                        <button type="submit" disabled={editLoading}>
                            {editLoading ? 'Saving...' : 'Save Changes'}
                        </button>

                        <button type="button" onClick={cancelEdit}>
                            Cancel
                        </button>
                    </form>
                </section>
            )}
            {selectedChemical && (
                <section className="panel table-panel">
                    <div className="panel-head">
                        <div>
                            <h3>Stock Movement History</h3>
                            <p>
                                {selectedChemical.chemical_name} ({selectedChemical.chemical_code})
                            </p>
                        </div>

                        <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                                setSelectedChemical(null);
                                setMovements([]);
                            }}
                        >
                            Close
                        </button>
                    </div>

                    {historyLoading ? (
                        <p>Loading movement history...</p>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Movement</th>
                                        <th>Quantity</th>
                                        <th>Reference</th>
                                        <th>Supervisor</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {movements.map(m => (
                                        <tr key={m.id}>
                                            <td>{new Date(m.created_at).toLocaleString()}</td>
                                            <td>{m.movement_type}</td>
                                            <td>
                                                {m.movement_type === 'ISSUE' ||
                                                    (m.movement_type === 'ADJUSTMENT' && Number(m.quantity) < 0)
                                                    ? '-'
                                                    : '+'}
                                                {Math.abs(Number(m.quantity)).toFixed(3)} {selectedChemical.unit}
                                            </td>
                                            <td>{m.reference_note || '—'}</td>
                                            <td>{m.supervisor_name || '—'}</td>
                                        </tr>
                                    ))}

                                    {!movements.length && (
                                        <tr>
                                            <td colSpan="5" className="empty">
                                                No movement history found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}
        </>
    );
}