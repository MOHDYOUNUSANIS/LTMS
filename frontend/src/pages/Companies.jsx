import React, { useEffect, useState } from 'react';
import { api } from '../api';

const emptyForm = {
  companyName: '',
  address: '',
  contactPerson: '',
  phone: ''
};

export default function Companies() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function loadCompanies() {
    try {
      setLoading(true);
      const data = await api(
        `/companies?search=${encodeURIComponent(search)}`
      );
      setRows(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, [search]);

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
    setError('');
    setSuccess('');
  }

  async function openEdit(company) {
    try {
      const data = await api(`/companies/${company.id}`);

      setForm({
        companyName: data.company_name || '',
        address: data.address || '',
        contactPerson: data.contact_person || '',
        phone: data.phone || ''
      });

      setEditingId(company.id);
      setShowForm(true);
      setSelected(null);
      setError('');
      setSuccess('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function viewCompany(company) {
    try {
      const data = await api(`/companies/${company.id}`);
      setSelected(data);
    } catch (e) {
      setError(e.message);
    }
  }

  async function saveCompany(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const payload = {
        companyName: form.companyName,
        address: form.address,
        contactPerson: form.contactPerson,
        phone: form.phone
      };

      if (editingId) {
        await api(`/companies/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSuccess('Company updated successfully.');
      } else {
        await api('/companies', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccess('Company created successfully.');
      }

      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      await loadCompanies();

    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleStatus(company) {
    const nextStatus = !company.is_active;

    const confirmed = window.confirm(
      `Are you sure you want to ${nextStatus ? 'activate' : 'deactivate'} ${company.company_name}?`
    );

    if (!confirmed) return;

    try {
      await api(`/companies/${company.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextStatus })
      });

      setSuccess(
        `Company ${nextStatus ? 'activated' : 'deactivated'} successfully.`
      );

      if (selected?.id === company.id) {
        const updated = await api(`/companies/${company.id}`);
        setSelected(updated);
      }

      await loadCompanies();

    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <h2>Company Management</h2>
          <p>Register and manage companies operating within LTMS.</p>
        </div>

        <button className="primary" onClick={openCreate}>
          + Add Company
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* Company registration form */}

      {showForm && (
        <section className="panel form-panel">
          <div className="panel-head">
            <h3>{editingId ? 'Edit Company' : 'Register New Company'}</h3>

            <button
              className="secondary-btn"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>

          <form className="company-form" onSubmit={saveCompany}>
            <div>
              <label>Company Name *</label>
              <input
                name="companyName"
                value={form.companyName}
                onChange={updateField}
                required
                placeholder="Enter company name"
              />
            </div>

            <div>
              <label>Contact Person</label>
              <input
                name="contactPerson"
                value={form.contactPerson}
                onChange={updateField}
                placeholder="Enter contact person"
              />
            </div>

            <div>
              <label>Phone Number</label>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={updateField}
                placeholder="Enter phone number"
              />
            </div>

            <div className="full-field">
              <label>Company Address</label>
              <textarea
                name="address"
                value={form.address}
                onChange={updateField}
                placeholder="Enter complete company address"
                rows="3"
              />
            </div>

            <div className="form-actions">
              <button className="primary" type="submit">
                {editingId ? 'Save Changes' : 'Create Company'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Company search */}

      <section className="panel company-search-panel">
        <div>
          <h3>Registered Companies</h3>
          <p>Search and manage your registered companies.</p>
        </div>

        <div className="search-row">
          <input
            type="search"
            placeholder="Search by company, contact person or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <span className="tag">{rows.length} RECORDS</span>
        </div>
      </section>

      {/* Companies table */}

      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>COMPANY</th>
                <th>CONTACT PERSON</th>
                <th>PHONE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>

            <tbody>
              {rows.map(company => (
                <tr key={company.id}>
                  <td>
                    <strong>{company.company_name}</strong>
                    <span className="cell-sub">
                      ID: {company.id}
                    </span>
                  </td>

                  <td>{company.contact_person || '—'}</td>

                  <td>{company.phone || '—'}</td>

                  <td>
                    <span
                      className={
                        company.is_active
                          ? 'company-status active'
                          : 'company-status inactive'
                      }
                    >
                      {company.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>

                  <td>
                    <div className="action-buttons">
                      <button
                        className="table-btn"
                        onClick={() => viewCompany(company)}
                      >
                        View
                      </button>

                      <button
                        className="table-btn"
                        onClick={() => openEdit(company)}
                      >
                        Edit
                      </button>

                      <button
                        className="table-btn"
                        onClick={() => toggleStatus(company)}
                      >
                        {company.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan="5" className="empty">
                    {loading
                      ? 'Loading companies...'
                      : 'No companies found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Individual company details */}

      {selected && (
        <section className="panel company-details">
          <div className="panel-head">
            <div>
              <span className="eyebrow">COMPANY PROFILE</span>
              <h3>{selected.company_name}</h3>
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
              <label>Company ID</label>
              <strong>{selected.id}</strong>
            </div>

            <div>
              <label>Contact Person</label>
              <strong>{selected.contact_person || 'Not provided'}</strong>
            </div>

            <div>
              <label>Phone Number</label>
              <strong>{selected.phone || 'Not provided'}</strong>
            </div>

            <div>
              <label>Status</label>
              <strong>
                {selected.is_active ? 'Active' : 'Inactive'}
              </strong>
            </div>

            <div className="full-field">
              <label>Address</label>
              <strong>{selected.address || 'Not provided'}</strong>
            </div>

            <div>
              <label>Registration Date</label>
              <strong>
                {selected.created_at
                  ? new Date(selected.created_at).toLocaleDateString()
                  : 'Not available'}
              </strong>
            </div>
          </div>
        </section>
      )}
    </>
  );
}