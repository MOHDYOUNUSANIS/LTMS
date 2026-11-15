import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
    company_id: '',
    template_name: '',
    species: '',
    product_name: '',
    colour: '',
    thickness_min_mm: '',
    thickness_max_mm: '',
    reference_weight_kg: '',
    reference_hides_sides: '',
    source_document: '',
    notes: ''
};
const emptyStepForm = {
    stage_name: '',
    sequence_no: '',
    float_percent: '',
    water_percent: '',
    target_ph_min: '',
    target_ph_max: '',
    duration_minutes: '',
    instruction: ''
};

export default function Processes() {
    const [companies, setCompanies] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [companyId, setCompanyId] = useState('');
    const [search, setSearch] = useState('');

    const [form, setForm] = useState(emptyForm);
    const [showForm, setShowForm] = useState(false);

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [stepForm, setStepForm] = useState(emptyStepForm);
    const [showStepForm, setShowStepForm] = useState(false);
    const [stepSaving, setStepSaving] = useState(false);

    const [chemicals, setChemicals] = useState([]);
    const [activeStepId, setActiveStepId] = useState(null);
    const [chemicalForm, setChemicalForm] = useState({
        chemical_id: '',
        chemical_label: '',
        dosage_basis: 'PERCENT_OF_PELT_WEIGHT',
        dosage_percent: '',
        fixed_quantity: '',
        unit: 'KG',
        addition_order: '',
        notes: ''
    });
    const [chemicalSaving, setChemicalSaving] = useState(false);



    async function loadCompanies() {
        try {
            const data = await api('/companies');
            const active = data.filter(c => c.is_active);

            setCompanies(active);

            if (active.length) {
                setCompanyId(String(active[0].id));
            }
        } catch (err) {
            setError(err.message);
        }
    }

    async function loadTemplates() {
        try {
            setLoading(true);
            const data = await api('/processes');
            setTemplates(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }
    async function openManage(templateId) {
        try {
            setTemplateLoading(true);
            setError('');
            setSelectedTemplate(null);

            const data = await api(`/processes/${templateId}`);
            setSelectedTemplate(data);

            const chemicalData = await api(
                `/chemicals?companyId=${data.company_id}`
            );

            setChemicals(chemicalData.filter(c => c.is_active));

        } catch (err) {
            setError(err.message);
        } finally {
            setTemplateLoading(false);
        }
    }
    async function createStep(e) {
        e.preventDefault();

        if (!selectedTemplate) return;

        setError('');
        setSuccess('');

        try {
            setStepSaving(true);

            const payload = {
                ...stepForm,
                sequence_no: Number(stepForm.sequence_no),
                float_percent: stepForm.float_percent === ''
                    ? null : Number(stepForm.float_percent),
                water_percent: stepForm.water_percent === ''
                    ? null : Number(stepForm.water_percent),
                target_ph_min: stepForm.target_ph_min === ''
                    ? null : Number(stepForm.target_ph_min),
                target_ph_max: stepForm.target_ph_max === ''
                    ? null : Number(stepForm.target_ph_max),
                duration_minutes: stepForm.duration_minutes === ''
                    ? null : Number(stepForm.duration_minutes)
            };

            await api(`/processes/${selectedTemplate.id}/steps`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const updated = await api(`/processes/${selectedTemplate.id}`);

            setSelectedTemplate(updated);
            setStepForm(emptyStepForm);
            setShowStepForm(false);
            setSuccess('Process stage added successfully.');

        } catch (err) {
            setError(err.message);
        } finally {
            setStepSaving(false);
        }
    }
    async function deleteStep(stepId) {
        if (!window.confirm('Are you sure you want to delete this stage?')) {
            return;
        }

        try {
            setError('');
            setSuccess('');

            await api(`/processes/steps/${stepId}`, {
                method: 'DELETE'
            });

            const updated = await api(`/processes/${selectedTemplate.id}`);

            setSelectedTemplate(updated);
            setSuccess('Process stage deleted successfully.');
        } catch (err) {
            setError(err.message);
        }
    }
    async function createChemicalMapping(e) {
        e.preventDefault();

        if (!activeStepId) return;

        setError('');
        setSuccess('');

        const selectedChemical = chemicals.find(
            c => String(c.id) === chemicalForm.chemical_id
        );

        if (!selectedChemical) {
            setError('Please select a chemical.');
            return;
        }

        const isFixed = chemicalForm.dosage_basis === 'FIXED_QUANTITY';

        if (isFixed && (!chemicalForm.fixed_quantity ||
            Number(chemicalForm.fixed_quantity) <= 0)) {
            setError('Enter a valid fixed quantity.');
            return;
        }

        if (!isFixed && (chemicalForm.dosage_percent === '' ||
            Number(chemicalForm.dosage_percent) < 0)) {
            setError('Enter a valid dosage percentage.');
            return;
        }

        try {
            setChemicalSaving(true);

            const payload = {
                ...chemicalForm,
                chemical_id: Number(chemicalForm.chemical_id),
                chemical_label: selectedChemical.chemical_name,
                dosage_percent: isFixed ? null : Number(chemicalForm.dosage_percent),
                fixed_quantity: isFixed ? Number(chemicalForm.fixed_quantity) : null,
                addition_order: chemicalForm.addition_order === ''
                    ? null : Number(chemicalForm.addition_order)
            };

            await api(
                `/processes/steps/${activeStepId}/chemicals`,
                {
                    method: 'POST',
                    body: JSON.stringify(payload)
                }
            );

            const updated = await api(
                `/processes/${selectedTemplate.id}`
            );

            setSelectedTemplate(updated);
            setActiveStepId(null);

            setChemicalForm({
                chemical_id: '',
                chemical_label: '',
                dosage_basis: 'PERCENT_OF_PELT_WEIGHT',
                dosage_percent: '',
                fixed_quantity: '',
                unit: 'KG',
                addition_order: '',
                notes: ''
            });

            setSuccess('Chemical mapped successfully.');

        } catch (err) {
            setError(err.message);
        } finally {
            setChemicalSaving(false);
        }
    }
    async function updateVerification(status) {
        if (!selectedTemplate) return;

        const messages = {
            CHEMIST_VERIFIED: 'Confirm that a qualified tannery chemist has verified this recipe.',
            APPROVED: 'Confirm that this template is ready for authorised use.',
            ARCHIVED: 'Are you sure you want to archive this template?'
        };

        if (!window.confirm(messages[status])) return;

        try {
            setError('');
            setSuccess('');

            await api(`/processes/${selectedTemplate.id}/verification`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });

            const updated = await api(`/processes/${selectedTemplate.id}`);
            setSelectedTemplate(updated);

            await loadTemplates();

            setSuccess(`Verification status updated to ${status}.`);
        } catch (err) {
            setError(err.message);
        }
    }
    async function deleteChemicalMapping(mappingId) {
        if (!window.confirm('Delete this chemical mapping?')) return;

        try {
            setError('');

            await api(`/processes/chemicals/${mappingId}`, {
                method: 'DELETE'
            });

            const updated = await api(`/processes/${selectedTemplate.id}`);
            setSelectedTemplate(updated);

            setSuccess('Chemical mapping deleted successfully.');
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        loadCompanies();
        loadTemplates();
    }, []);

    function change(e) {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        });
    }

    async function createTemplate(e) {
        e.preventDefault();

        setError('');
        setSuccess('');

        if (!form.company_id) {
            setError('Please select a company.');
            return;
        }

        if (!form.template_name.trim()) {
            setError('Template name is required.');
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ...form,
                company_id: Number(form.company_id),
                thickness_min_mm: form.thickness_min_mm === ''
                    ? null : Number(form.thickness_min_mm),
                thickness_max_mm: form.thickness_max_mm === ''
                    ? null : Number(form.thickness_max_mm),
                reference_weight_kg: form.reference_weight_kg === ''
                    ? null : Number(form.reference_weight_kg)
            };

            const result = await api('/processes', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            setSuccess(
                `Process template created successfully. ID: ${result.templateId}`
            );

            setForm(emptyForm);
            setShowForm(false);

            await loadTemplates();

        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    const filteredTemplates = templates.filter(template => {
        const matchesCompany =
            !companyId || String(template.company_id) === companyId;

        const searchText = search.toLowerCase();

        const matchesSearch =
            (template.template_name || '').toLowerCase().includes(searchText) ||
            (template.species || '').toLowerCase().includes(searchText) ||
            (template.product_name || '').toLowerCase().includes(searchText) ||
            (template.colour || '').toLowerCase().includes(searchText);

        return matchesCompany && matchesSearch;
    });

    function statusClass(status) {
        if (status === 'APPROVED') return 'company-status active';
        if (status === 'ARCHIVED') return 'company-status inactive';

        return 'status-pill';
    }

    return (
        <>
            <div className="page-heading">
                <div>
                    <h2>Process Library</h2>
                    <p>Manage leather processing templates and recipes.</p>
                </div>

                <button
                    className="primary"
                    onClick={() => {
                        setShowForm(!showForm);
                        setError('');
                        setSuccess('');
                    }}
                >
                    {showForm ? 'Cancel' : '+ Create Process'}
                </button>
            </div>

            <div className="stats">
                <div className="stat-card">
                    <span>Total Templates</span>
                    <strong>{templates.length}</strong>
                    <small>All companies</small>
                </div>

                <div className="stat-card">
                    <span>Draft</span>
                    <strong>
                        {templates.filter(t =>
                            t.verification_status === 'DRAFT'
                        ).length}
                    </strong>
                    <small>Under preparation</small>
                </div>

                <div className="stat-card">
                    <span>Approved</span>
                    <strong>
                        {templates.filter(t =>
                            t.verification_status === 'APPROVED'
                        ).length}
                    </strong>
                    <small>Approved templates</small>
                </div>

                <div className="stat-card">
                    <span>Archived</span>
                    <strong>
                        {templates.filter(t =>
                            t.verification_status === 'ARCHIVED'
                        ).length}
                    </strong>
                    <small>Archived templates</small>
                </div>
            </div>

            {error && <p className="error">{error}</p>}
            {success && <p className="success">{success}</p>}

            {showForm && (
                <section className="panel form-panel">
                    <h3>Create Process Template</h3>

                    <form className="company-form" onSubmit={createTemplate}>

                        <div>
                            <label>Company *</label>
                            <select
                                name="company_id"
                                value={form.company_id}
                                onChange={change}
                                required
                            >
                                <option value="">Select company</option>

                                {companies.map(company => (
                                    <option key={company.id} value={company.id}>
                                        {company.company_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label>Template Name *</label>
                            <input
                                name="template_name"
                                value={form.template_name}
                                onChange={change}
                                placeholder="e.g. Goat Lining Upper"
                                required
                            />
                        </div>

                        <div>
                            <label>Leather Species</label>
                            <select
                                name="species"
                                value={form.species}
                                onChange={change}
                            >
                                <option value="">Select species</option>
                                <option value="COW">Cow</option>
                                <option value="BUFFALO">Buffalo</option>
                                <option value="GOAT">Goat</option>
                                <option value="SHEEP">Sheep</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>

                        <div>
                            <label>Product Name</label>
                            <input
                                name="product_name"
                                value={form.product_name}
                                onChange={change}
                                placeholder="e.g. Lining Upper"
                            />
                        </div>

                        <div>
                            <label>Colour</label>
                            <input
                                name="colour"
                                value={form.colour}
                                onChange={change}
                                placeholder="e.g. Black"
                            />
                        </div>

                        <div>
                            <label>Minimum Thickness (mm)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
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
                                min="0"
                                name="thickness_max_mm"
                                value={form.thickness_max_mm}
                                onChange={change}
                            />
                        </div>

                        <div>
                            <label>Reference Weight (kg)</label>
                            <input
                                type="number"
                                step="0.001"
                                min="0"
                                name="reference_weight_kg"
                                value={form.reference_weight_kg}
                                onChange={change}
                            />
                        </div>

                        <div>
                            <label>Reference Hides / Sides</label>
                            <input
                                name="reference_hides_sides"
                                value={form.reference_hides_sides}
                                onChange={change}
                                placeholder="e.g. 600 pieces"
                            />
                        </div>

                        <div>
                            <label>Source Document</label>
                            <input
                                name="source_document"
                                value={form.source_document}
                                onChange={change}
                                placeholder="Original process sheet"
                            />
                        </div>

                        <div className="full-field">
                            <label>Notes</label>
                            <textarea
                                name="notes"
                                value={form.notes}
                                onChange={change}
                                rows="3"
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="submit"
                                className="primary"
                                disabled={saving || !companies.length}
                            >
                                {saving ? 'Saving...' : 'Save Template'}
                            </button>
                        </div>

                    </form>
                </section>
            )}

            <section className="panel company-search-panel">
                <div className="panel-head">
                    <div>
                        <h3>Process Templates</h3>
                        <p>Search and manage saved process templates.</p>
                    </div>

                    <span className="tag">
                        {filteredTemplates.length} TEMPLATES
                    </span>
                </div>

                <div className="search-row">
                    <select
                        value={companyId}
                        onChange={e => setCompanyId(e.target.value)}
                    >
                        <option value="">All Companies</option>

                        {companies.map(company => (
                            <option key={company.id} value={company.id}>
                                {company.company_name}
                            </option>
                        ))}
                    </select>

                    <input
                        type="text"
                        placeholder="Search template, species, product or colour..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </section>
            {selectedTemplate && (
                <section className="panel form-panel">
                    <div className="panel-head">
                        <div>
                            <h3>{selectedTemplate.template_name}</h3>
                            <p>
                                {selectedTemplate.species || '—'} |{' '}
                                {selectedTemplate.product_name || '—'} |{' '}
                                {selectedTemplate.colour || '—'}
                            </p>
                        </div>

                        <button
                            type="button"
                            className="primary"
                            onClick={() => setSelectedTemplate(null)}
                        >
                            Close
                        </button>
                    </div>
                    <div className="panel-head">
                        <div>
                            <h3>Verification Workflow</h3>
                            <p>Current status: {selectedTemplate.verification_status}</p>
                        </div>

                        <div className="form-actions">
                            {selectedTemplate.verification_status === 'DRAFT' && (
                                <button
                                    type="button"
                                    className="primary"
                                    onClick={() => updateVerification('CHEMIST_VERIFIED')}
                                >
                                    Mark Chemist Verified
                                </button>
                            )}

                            {selectedTemplate.verification_status === 'CHEMIST_VERIFIED' && (
                                <button
                                    type="button"
                                    className="primary"
                                    onClick={() => updateVerification('APPROVED')}
                                >
                                    Approve Template
                                </button>
                            )}

                            {selectedTemplate.verification_status === 'APPROVED' && (
                                <button
                                    type="button"
                                    onClick={() => updateVerification('ARCHIVED')}
                                >
                                    Archive Template
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="stats">
                        <div className="stat-card">
                            <span>Company ID</span>
                            <strong>{selectedTemplate.company_id}</strong>
                        </div>

                        <div className="stat-card">
                            <span>Reference Weight</span>
                            <strong>
                                {selectedTemplate.reference_weight_kg || '—'} kg
                            </strong>
                        </div>

                        <div className="stat-card">
                            <span>Thickness</span>
                            <strong>
                                {selectedTemplate.thickness_min_mm ?? '—'} -{' '}
                                {selectedTemplate.thickness_max_mm ?? '—'} mm
                            </strong>
                        </div>

                        <div className="stat-card">
                            <span>Verification</span>
                            <strong>{selectedTemplate.verification_status}</strong>
                        </div>
                    </div>

                    <div className="panel-head">
                        <div>
                            <h3>Process Stages</h3>
                            <p>
                                {selectedTemplate.steps?.length || 0} stages configured
                            </p>
                        </div>

                        <button
                            type="button"
                            className="primary"
                            onClick={() => setShowStepForm(!showStepForm)}
                        >
                            {showStepForm ? 'Cancel' : '+ Add Stage'}
                        </button>
                    </div>

                    {showStepForm && (
                        <form className="company-form" onSubmit={createStep}>

                            <div>
                                <label>Stage Name *</label>
                                <input
                                    value={stepForm.stage_name}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        stage_name: e.target.value
                                    })}
                                    placeholder="e.g. Initial Process"
                                    required
                                />
                            </div>

                            <div>
                                <label>Sequence Number *</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={stepForm.sequence_no}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        sequence_no: e.target.value
                                    })}
                                    required
                                />
                            </div>

                            <div>
                                <label>Float (%)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={stepForm.float_percent}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        float_percent: e.target.value
                                    })}
                                />
                            </div>

                            <div>
                                <label>Water (%)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    value={stepForm.water_percent}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        water_percent: e.target.value
                                    })}
                                />
                            </div>

                            <div>
                                <label>Minimum pH</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={stepForm.target_ph_min}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        target_ph_min: e.target.value
                                    })}
                                />
                            </div>

                            <div>
                                <label>Maximum pH</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={stepForm.target_ph_max}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        target_ph_max: e.target.value
                                    })}
                                />
                            </div>

                            <div>
                                <label>Duration (Minutes)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={stepForm.duration_minutes}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        duration_minutes: e.target.value
                                    })}
                                />
                            </div>

                            <div className="full-field">
                                <label>Instructions</label>
                                <textarea
                                    rows="3"
                                    value={stepForm.instruction}
                                    onChange={e => setStepForm({
                                        ...stepForm,
                                        instruction: e.target.value
                                    })}
                                />
                            </div>

                            <div className="form-actions">
                                <button
                                    type="submit"
                                    className="primary"
                                    disabled={stepSaving}
                                >
                                    {stepSaving ? 'Saving...' : 'Save Stage'}
                                </button>
                            </div>

                        </form>
                    )}

                    {selectedTemplate.steps?.length > 0 ? (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Sequence</th>
                                        <th>Stage Name</th>
                                        <th>Duration</th>
                                        <th>Target pH</th>
                                        <th>Chemicals</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {selectedTemplate.steps.map(step => (
                                        <tr key={step.id}>
                                            <td>{step.sequence_no}</td>
                                            <td>{step.stage_name}</td>
                                            <td>
                                                {step.duration_minutes ?? '—'}
                                            </td>
                                            <td>
                                                {step.target_ph_min ?? '—'} -{' '}
                                                {step.target_ph_max ?? '—'}
                                            </td>
                                            <td>
                                                {step.chemicals?.length || 0}

                                                {step.chemicals?.map(chemical => (
                                                    <div key={chemical.id} className="cell-sub">
                                                        <strong>
                                                            {chemical.chemical_name || chemical.chemical_label}
                                                        </strong>
                                                        <br />

                                                        Basis: {chemical.dosage_basis}
                                                        <br />

                                                        {chemical.dosage_basis === 'FIXED_QUANTITY'
                                                            ? `${chemical.fixed_quantity} ${chemical.unit}`
                                                            : `${chemical.dosage_percent}%`}

                                                        <br />

                                                        <button
                                                            type="button"
                                                            onClick={() => deleteChemicalMapping(chemical.id)}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                ))}

                                                <button
                                                    type="button"
                                                    onClick={() => setActiveStepId(
                                                        activeStepId === step.id ? null : step.id
                                                    )}
                                                >
                                                    {activeStepId === step.id ? 'Cancel' : '+ Add Chemical'}
                                                </button>

                                                {activeStepId === step.id && (
                                                    <form onSubmit={createChemicalMapping}>
                                                        <select
                                                            value={chemicalForm.chemical_id}
                                                            onChange={e => setChemicalForm({
                                                                ...chemicalForm,
                                                                chemical_id: e.target.value
                                                            })}
                                                            required
                                                        >
                                                            <option value="">Select chemical</option>

                                                            {chemicals.map(c => (
                                                                <option key={c.id} value={c.id}>
                                                                    {c.chemical_name} ({c.chemical_code})
                                                                </option>
                                                            ))}
                                                        </select>

                                                        <select
                                                            value={chemicalForm.dosage_basis}
                                                            onChange={e => setChemicalForm({
                                                                ...chemicalForm,
                                                                dosage_basis: e.target.value
                                                            })}
                                                        >
                                                            <option value="PERCENT_OF_PELT_WEIGHT">
                                                                % of Pelt Weight
                                                            </option>
                                                            <option value="PERCENT_OF_FLOAT">
                                                                % of Float
                                                            </option>
                                                            <option value="FIXED_QUANTITY">
                                                                Fixed Quantity
                                                            </option>
                                                        </select>

                                                        {chemicalForm.dosage_basis === 'FIXED_QUANTITY' ? (
                                                            <input
                                                                type="number"
                                                                min="0.001"
                                                                step="0.001"
                                                                placeholder="Fixed quantity"
                                                                value={chemicalForm.fixed_quantity}
                                                                onChange={e => setChemicalForm({
                                                                    ...chemicalForm,
                                                                    fixed_quantity: e.target.value
                                                                })}
                                                                required
                                                            />
                                                        ) : (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.0001"
                                                                placeholder="Dosage (%)"
                                                                value={chemicalForm.dosage_percent}
                                                                onChange={e => setChemicalForm({
                                                                    ...chemicalForm,
                                                                    dosage_percent: e.target.value
                                                                })}
                                                                required
                                                            />
                                                        )}

                                                        <select
                                                            value={chemicalForm.unit}
                                                            onChange={e => setChemicalForm({
                                                                ...chemicalForm,
                                                                unit: e.target.value
                                                            })}
                                                        >
                                                            <option value="KG">KG</option>
                                                            <option value="LITRE">Litre</option>
                                                            <option value="PCS">Pieces</option>
                                                        </select>

                                                        <input
                                                            type="number"
                                                            min="1"
                                                            placeholder="Addition order"
                                                            value={chemicalForm.addition_order}
                                                            onChange={e => setChemicalForm({
                                                                ...chemicalForm,
                                                                addition_order: e.target.value
                                                            })}
                                                        />

                                                        <input
                                                            placeholder="Notes"
                                                            value={chemicalForm.notes}
                                                            onChange={e => setChemicalForm({
                                                                ...chemicalForm,
                                                                notes: e.target.value
                                                            })}
                                                        />

                                                        <button type="submit" disabled={chemicalSaving}>
                                                            {chemicalSaving ? 'Saving...' : 'Save Chemical'}
                                                        </button>
                                                    </form>
                                                )}
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteStep(step.id)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="empty">
                            No process stages have been added yet.
                        </p>
                    )}
                </section>
            )}

            {templateLoading && (
                <p className="empty">Loading template details...</p>
            )}

            <section className="panel table-panel">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Template</th>
                                <th>Company</th>
                                <th>Species</th>
                                <th>Product</th>
                                <th>Colour</th>
                                <th>Thickness</th>
                                <th>Verification</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredTemplates.map(template => (
                                <tr key={template.id}>
                                    <td>
                                        <strong>{template.template_name}</strong>
                                        <small className="cell-sub">
                                            ID: {template.id}
                                        </small>
                                    </td>

                                    <td>{template.company_name || '—'}</td>
                                    <td>{template.species || '—'}</td>
                                    <td>{template.product_name || '—'}</td>
                                    <td>{template.colour || '—'}</td>

                                    <td>
                                        {template.thickness_min_mm != null
                                            ? `${template.thickness_min_mm} - ${template.thickness_max_mm} mm`
                                            : '—'}
                                    </td>

                                    <td>
                                        <span className={statusClass(template.verification_status)}>
                                            {template.verification_status}
                                        </span>
                                    </td>

                                    <td>
                                        {template.created_at
                                            ? new Date(template.created_at).toLocaleDateString()
                                            : '—'}
                                    </td>
                                    <td>
                                        <button
                                            type="button"
                                            className="primary"
                                            onClick={() => openManage(template.id)}
                                        >
                                            Manage
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {!loading && !filteredTemplates.length && (
                                <tr>
                                    <td colSpan="9" className="empty">
                                        No process templates found.
                                    </td>
                                </tr>
                            )}

                            {loading && (
                                <tr>
                                    <td colSpan="9" className="empty">
                                        Loading process templates...
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