import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
    company_id: '',
    drum_id: '',
    template_id: '',
    product_name: '',
    species: '',
    colour: '',
    hides_sides_count: '',
    input_weight_kg: '',
    thickness_min_mm: '',
    thickness_max_mm: '',
    notes: ''
};

export default function Production() {
    const [companies, setCompanies] = useState([]);
    const [drums, setDrums] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [batches, setBatches] = useState([]);

    const [form, setForm] = useState(emptyForm);
    const [showForm, setShowForm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [updatingBatch, setUpdatingBatch] = useState(null);

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    async function loadData() {
        try {
            setLoading(true);

            const [companyData, drumData, templateData, batchData] =
                await Promise.all([
                    api('/companies'),
                    api('/drums'),
                    api('/processes'),
                    api('/production')
                ]);

            setCompanies(companyData.filter(c => c.is_active));
            setDrums(drumData);
            setTemplates(templateData);
            setBatches(batchData);

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadData();
    }, []);

    function change(e) {
        const { name, value } = e.target;

        setForm(prev => ({
            ...prev,
            [name]: value
        }));

        if (name === 'template_id' && value) {
            const template = templates.find(
                t => String(t.id) === value
            );

            if (template) {
                setForm(prev => ({
                    ...prev,
                    template_id: value,
                    product_name: template.product_name || '',
                    species: template.species || '',
                    colour: template.colour || '',
                    thickness_min_mm: template.thickness_min_mm ?? '',
                    thickness_max_mm: template.thickness_max_mm ?? ''
                }));
            }
        }
    }

    const availableDrums = drums.filter(
        d =>
            String(d.company_id) === form.company_id &&
            d.status === 'AVAILABLE'
    );

    const approvedTemplates = templates.filter(
        t =>
            String(t.company_id) === form.company_id &&
            t.verification_status === 'APPROVED'
    );

    async function createBatch(e) {
        e.preventDefault();

        setError('');
        setSuccess('');

        if (!form.company_id || !form.drum_id) {
            setError('Please select a company and available drum.');
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ...form,
                company_id: Number(form.company_id),
                drum_id: Number(form.drum_id),
                template_id: form.template_id
                    ? Number(form.template_id)
                    : null,
                hides_sides_count: form.hides_sides_count
                    ? Number(form.hides_sides_count)
                    : null,
                input_weight_kg: Number(form.input_weight_kg),
                thickness_min_mm: form.thickness_min_mm === ''
                    ? null : Number(form.thickness_min_mm),
                thickness_max_mm: form.thickness_max_mm === ''
                    ? null : Number(form.thickness_max_mm)
            };

            const result = await api('/production', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            setSuccess(
                `Batch ${result.batchCode} created successfully.`
            );

            setForm(emptyForm);
            setShowForm(false);

            await loadData();

        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    // Update production batch status
    async function updateStatus(batch, newStatus) {
        const actionNames = {
            IN_PROGRESS: 'start',
            ON_HOLD: 'put on hold',
            COMPLETED: 'complete',
            CANCELLED: 'cancel'
        };

        const action = actionNames[newStatus];

        if (
            ['COMPLETED', 'CANCELLED'].includes(newStatus) &&
            !window.confirm(`Are you sure you want to ${action} this batch?`)
        ) {
            return;
        }

        setError('');
        setSuccess('');
        setUpdatingBatch(batch.id);

        try {
            const result = await api(
                `/production/${batch.id}/status`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ status: newStatus })
                }
            );

            setSuccess(result.message);
            await loadData();

        } catch (err) {
            setError(err.message);
        } finally {
            setUpdatingBatch(null);
        }
    }

    const running = batches.filter(
        b => b.status === 'IN_PROGRESS'
    ).length;

    const planned = batches.filter(
        b => b.status === 'PLANNED'
    ).length;

    const completed = batches.filter(
        b => b.status === 'COMPLETED'
    ).length;

    const onHold = batches.filter(
        b => b.status === 'ON_HOLD'
    ).length;

    function renderActions(batch) {
        const isUpdating = updatingBatch === batch.id;

        return (
            <div className="form-actions">
                {batch.status === 'PLANNED' && (
                    <>
                        <button
                            type="button"
                            className="primary"
                            disabled={isUpdating}
                            onClick={() => updateStatus(batch, 'IN_PROGRESS')}
                        >
                            {isUpdating ? 'Updating...' : '▶ Start'}
                        </button>

                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStatus(batch, 'CANCELLED')}
                        >
                            Cancel
                        </button>
                    </>
                )}

                {batch.status === 'IN_PROGRESS' && (
                    <>
                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStatus(batch, 'ON_HOLD')}
                        >
                            ⏸ Hold
                        </button>

                        <button
                            type="button"
                            className="primary"
                            disabled={isUpdating}
                            onClick={() => updateStatus(batch, 'COMPLETED')}
                        >
                            ✓ Complete
                        </button>
                    </>
                )}

                {batch.status === 'ON_HOLD' && (
                    <>
                        <button
                            type="button"
                            className="primary"
                            disabled={isUpdating}
                            onClick={() => updateStatus(batch, 'IN_PROGRESS')}
                        >
                            ▶ Resume
                        </button>

                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => updateStatus(batch, 'CANCELLED')}
                        >
                            Cancel
                        </button>
                    </>
                )}

                {['COMPLETED', 'CANCELLED'].includes(batch.status) && (
                    <span>—</span>
                )}
            </div>
        );
    }

    return (
        <>
            <div className="page-heading">
                <div>
                    <h2>Production Management</h2>
                    <p>Create and manage leather production batches.</p>
                </div>

                <button
                    className="primary"
                    onClick={() => {
                        setShowForm(!showForm);
                        setError('');
                        setSuccess('');
                    }}
                >
                    {showForm ? 'Cancel' : '+ Create Batch'}
                </button>
            </div>

            <div className="stats">
                <div className="stat-card">
                    <span>Total Batches</span>
                    <strong>{batches.length}</strong>
                </div>

                <div className="stat-card">
                    <span>Planned</span>
                    <strong>{planned}</strong>
                </div>

                <div className="stat-card">
                    <span>In Progress</span>
                    <strong>{running}</strong>
                </div>

                <div className="stat-card">
                    <span>On Hold</span>
                    <strong>{onHold}</strong>
                </div>

                <div className="stat-card">
                    <span>Completed</span>
                    <strong>{completed}</strong>
                </div>
            </div>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}

            {showForm && (
                <section className="panel form-panel">
                    <h3>Create Production Batch</h3>

                    <form
                        className="company-form"
                        onSubmit={createBatch}
                    >
                        <div>
                            <label>Company *</label>
                            <select
                                name="company_id"
                                value={form.company_id}
                                onChange={e => setForm({
                                    ...form,
                                    company_id: e.target.value,
                                    drum_id: '',
                                    template_id: ''
                                })}
                                required
                            >
                                <option value="">Select company</option>

                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label>Available Drum *</label>
                            <select
                                name="drum_id"
                                value={form.drum_id}
                                onChange={change}
                                required
                            >
                                <option value="">Select drum</option>

                                {availableDrums.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.drum_code} — {d.capacity_kg} kg
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="full-field">
                            <label>Approved Process Template</label>
                            <select
                                name="template_id"
                                value={form.template_id}
                                onChange={change}
                            >
                                <option value="">
                                    Select approved template
                                </option>

                                {approvedTemplates.map(t => (
                                    <option key={t.id} value={t.id}>
                                        {t.template_name}
                                    </option>
                                ))}
                            </select>

                            {!approvedTemplates.length && (
                                <small>
                                    No approved templates available for this company.
                                </small>
                            )}
                        </div>

                        <div>
                            <label>Product Name *</label>
                            <input
                                name="product_name"
                                value={form.product_name}
                                onChange={change}
                                required
                            />
                        </div>

                        <div>
                            <label>Species</label>
                            <input
                                name="species"
                                value={form.species}
                                onChange={change}
                            />
                        </div>

                        <div>
                            <label>Colour</label>
                            <input
                                name="colour"
                                value={form.colour}
                                onChange={change}
                            />
                        </div>

                        <div>
                            <label>Batch Weight (kg) *</label>
                            <input
                                type="number"
                                name="input_weight_kg"
                                min="0.001"
                                step="0.001"
                                value={form.input_weight_kg}
                                onChange={change}
                                required
                            />
                        </div>

                        <div>
                            <label>Hides / Sides Quantity</label>
                            <input
                                type="number"
                                name="hides_sides_count"
                                min="1"
                                value={form.hides_sides_count}
                                onChange={change}
                            />
                        </div>

                        <div>
                            <label>Minimum Thickness (mm)</label>
                            <input
                                type="number"
                                step="0.01"
                                name="thickness_min_mm"
                                value={form.thickness_min_mm}
                                onChange={change}
                            />
                        </div>

                        <div>
                            <label>Maximum Thickness (mm)</label>
                            <input
                                type="number"
                                step="0.01"
                                name="thickness_max_mm"
                                value={form.thickness_max_mm}
                                onChange={change}
                            />
                        </div>

                        <div className="full-field">
                            <label>Notes</label>
                            <textarea
                                name="notes"
                                rows="3"
                                value={form.notes}
                                onChange={change}
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="primary"
                                disabled={saving}
                            >
                                {saving ? 'Creating...' : 'Create Batch'}
                            </button>
                        </div>
                    </form>
                </section>
            )}

            <section className="panel table-panel">
                <div className="panel-head">
                    <div>
                        <h3>Production Batches</h3>
                        <p>All registered production batches.</p>
                    </div>

                    <button type="button" onClick={loadData}>
                        Refresh
                    </button>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Batch Code</th>
                                <th>Company</th>
                                <th>Drum</th>
                                <th>Product</th>
                                <th>Weight</th>
                                <th>Quantity</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {batches.map(batch => (
                                <tr key={batch.id}>
                                    <td>
                                        <strong>{batch.batch_code}</strong>
                                    </td>
                                    <td>{batch.company_name}</td>
                                    <td>{batch.drum_code}</td>
                                    <td>{batch.product_name}</td>
                                    <td>{batch.input_weight_kg} kg</td>
                                    <td>{batch.hides_sides_count ?? '—'}</td>
                                    <td>
                                        <span className="status-pill">
                                            {batch.status}
                                        </span>
                                    </td>
                                    <td>{renderActions(batch)}</td>
                                </tr>
                            ))}

                            {!loading && !batches.length && (
                                <tr>
                                    <td colSpan="8" className="empty">
                                        No production batches found.
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td colSpan="8" className="empty">
                                        Loading production batches...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </>
    );
}