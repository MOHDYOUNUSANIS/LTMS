import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
  companyId: '',
  drumCode: '',
  drumType: 'WOODEN',
  capacityKg: '',
  location: ''
};

export default function Drums() {
  const [drums, setDrums] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function loadDrums() {
    try {
      setLoading(true);

      const data = await api(
        `/drums?search=${encodeURIComponent(search)}`
      );

      setDrums(data);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadCompanies() {
    try {
      const data = await api('/companies');

      setCompanies(
        data.filter(company => Boolean(company.is_active))
      );
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadDrums();
  }, [search]);

  useEffect(() => {
    loadCompanies();
  }, []);

  function updateField(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setSelected(null);
    setError('');
    setSuccess('');
  }

  async function openEdit(drum) {
    try {
      const data = await api(`/drums/${drum.id}`);

      setForm({
        companyId: String(data.company_id),
        drumCode: data.drum_code || '',
        drumType: data.drum_type || 'WOODEN',
        capacityKg: data.capacity_kg ?? '',
        location: data.location || ''
      });

      setEditingId(drum.id);
      setShowForm(true);
      setSelected(null);
      setError('');
      setSuccess('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function viewDrum(drum) {
    try {
      const data = await api(`/drums/${drum.id}`);
      setSelected(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveDrum(e) {
    e.preventDefault();

    setError('');
    setSuccess('');

    try {
      setSaving(true);

      const payload = {
        ...form,
        companyId: Number(form.companyId),
        capacityKg: form.capacityKg
          ? Number(form.capacityKg)
          : null
      };

      if (editingId !== null) {
        await api(`/drums/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });

        setSuccess('Drum updated successfully!');
      } else {
        await api('/drums', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        setSuccess('Drum registered successfully!');
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);

      await loadDrums();

    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(drum, status) {
    if (drum.status === status) return;

    const confirmed = window.confirm(
      `Change ${drum.drum_code} status to ${status}?`
    );

    if (!confirmed) return;

    try {
      await api(`/drums/${drum.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });

      setSuccess(
        `${drum.drum_code} status changed to ${status}.`
      );

      if (selected?.id === drum.id) {
        const updated = await api(`/drums/${drum.id}`);
        setSelected(updated);
      }

      await loadDrums();

    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <div className="page-heading">
        <div>
          <h2>Drum Management</h2>
          <p>Register, monitor and manage tannery drums.</p>
        </div>

        <button className="primary" onClick={openCreate}>
          + Add Drum
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {showForm && (
        <section className="panel form-panel">

          <div className="panel-head">
            <h3>
              {editingId !== null ? 'Edit Drum' : 'Register New Drum'}
            </h3>

            <button
              className="secondary-btn"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>

          <form className="company-form" onSubmit={saveDrum}>

            <div>
              <label>Company *</label>

              <select
                name="companyId"
                value={form.companyId}
                onChange={updateField}
                required
              >
                <option value="">Select Company</option>

                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Drum Number *</label>

              <input
                name="drumCode"
                value={form.drumCode}
                onChange={updateField}
                placeholder="e.g. DRUM-003"
                required
              />
            </div>

            <div>
              <label>Drum Type *</label>

              <select
                name="drumType"
                value={form.drumType}
                onChange={updateField}
                required
              >
                <option value="WOODEN">Wooden</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label>Capacity (KG)</label>

              <input
                type="number"
                name="capacityKg"
                value={form.capacityKg}
                onChange={updateField}
                min="0.01"
                step="0.01"
                placeholder="Enter capacity"
              />
            </div>

            <div className="full-field">
              <label>Location</label>

              <input
                name="location"
                value={form.location}
                onChange={updateField}
                placeholder="Enter drum location"
              />
            </div>

            <div className="form-actions">
              <button
                className="primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingId !== null
                    ? 'Save Changes'
                    : 'Register Drum'}
              </button>
            </div>

          </form>
        </section>
      )}

      <section className="dashboard-grid">

        <div className="stat-card">
          <span>Total Drums</span>
          <h2>{drums.length}</h2>
        </div>

        <div className="stat-card">
          <span>Available</span>
          <h2>
            {drums.filter(d => d.status === 'AVAILABLE').length}
          </h2>
        </div>

        <div className="stat-card">
          <span>Running</span>
          <h2>
            {drums.filter(d => d.status === 'RUNNING').length}
          </h2>
        </div>

        <div className="stat-card">
          <span>Maintenance</span>
          <h2>
            {drums.filter(d => d.status === 'MAINTENANCE').length}
          </h2>
        </div>

      </section>

      <section className="panel company-search-panel">

        <div>
          <h3>Registered Drums</h3>
          <p>Search and monitor your registered drums.</p>
        </div>

        <div className="search-row">
          <input
            type="search"
            placeholder="Search by drum number or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <span className="tag">
            {drums.length} RECORDS
          </span>
        </div>

      </section>

      <section className="panel table-panel">

        <div className="table-wrap">
          <table>

            <thead>
              <tr>
                <th>DRUM NUMBER</th>
                <th>COMPANY</th>
                <th>TYPE</th>
                <th>CAPACITY</th>
                <th>LOCATION</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>

              {drums.map(drum => (
                <tr key={drum.id}>

                  <td>
                    <strong>{drum.drum_code}</strong>
                    <span className="cell-sub">
                      ID: {drum.id}
                    </span>
                  </td>

                  <td>{drum.company_name}</td>
                  <td>{drum.drum_type}</td>
                  <td>{drum.capacity_kg ?? '—'} kg</td>
                  <td>{drum.location || '—'}</td>

                  <td>
                    <span className={`company-status ${
                      drum.status === 'AVAILABLE'
                        ? 'active'
                        : drum.status === 'RUNNING'
                          ? 'running'
                          : 'inactive'
                    }`}>
                      {drum.status}
                    </span>
                  </td>

                  <td>
                    <div className="action-buttons">

                      <button
                        className="table-btn"
                        onClick={() => viewDrum(drum)}
                      >
                        View
                      </button>

                      <button
                        className="table-btn"
                        onClick={() => openEdit(drum)}
                      >
                        Edit
                      </button>

                      <select
                        className="table-btn"
                        value={drum.status}
                        onChange={e =>
                          changeStatus(drum, e.target.value)
                        }
                        aria-label={`Change status of ${drum.drum_code}`}
                      >
                        <option value="AVAILABLE">Available</option>
                        <option value="RUNNING">Running</option>
                        <option value="MAINTENANCE">Maintenance</option>
                      </select>

                    </div>
                  </td>

                </tr>
              ))}

              {!drums.length && (
                <tr>
                  <td colSpan="7" className="empty">
                    {loading ? 'Loading drums...' : 'No drums found.'}
                  </td>
                </tr>
              )}

            </tbody>

          </table>
        </div>

      </section>

      {selected && (
        <section className="panel company-details">

          <div className="panel-head">
            <div>
              <span className="eyebrow">DRUM PROFILE</span>
              <h3>{selected.drum_code}</h3>
            </div>

            <button
              className="secondary-btn"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>

          <div className="details-grid">

            <div>
              <label>Drum ID</label>
              <strong>{selected.id}</strong>
            </div>

            <div>
              <label>Company</label>
              <strong>{selected.company_name}</strong>
            </div>

            <div>
              <label>Drum Type</label>
              <strong>{selected.drum_type}</strong>
            </div>

            <div>
              <label>Capacity</label>
              <strong>{selected.capacity_kg ?? 'Not provided'} kg</strong>
            </div>

            <div>
              <label>Location</label>
              <strong>{selected.location || 'Not provided'}</strong>
            </div>

            <div>
              <label>Status</label>
              <strong>{selected.status}</strong>
            </div>

          </div>

        </section>
      )}

    </div>
  );
}