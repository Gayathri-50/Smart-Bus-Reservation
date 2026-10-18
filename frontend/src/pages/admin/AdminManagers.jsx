import { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Key,
  Pencil,
  Plus,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import api from '../../services/api';

const roleMeta = {
  bus_manager: {
    label: 'Bus Operations Manager',
    badgeClass: 'status-pill info',
    description: 'Manages bus fleet, routes, fares, and schedules',
  },
  booking_manager: {
    label: 'Booking Manager',
    badgeClass: 'status-pill success',
    description: 'Manages reservations, passenger bookings, and emergencies',
  },
  finance_manager: {
    label: 'Finance Manager',
    badgeClass: 'status-pill warning',
    description: 'Audits transactions, revenues, and financial exports',
  },
};

const initialForm = {
  name: '',
  email: '',
  phone: '',
  role: 'bus_manager',
  password: '',
  confirmPassword: '',
};

const AdminManagers = () => {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);
  const [editData, setEditData] = useState({ id: '', name: '', phone: '', role: 'bus_manager', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchManagers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/managers');
      setManagers(res.data.managers || []);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to load manager accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const clearMessages = () => {
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    if (!formData.name || !formData.email || !formData.password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    try {
      await api.post('/admin/managers', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        password: formData.password,
      });

      setSuccessMsg(`Manager account created for ${formData.email}`);
      setFormData(initialForm);
      setModalOpen(false);
      fetchManagers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error creating manager account.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    try {
      await api.put(`/admin/managers/${editData.id}`, {
        name: editData.name,
        phone: editData.phone,
        role: editData.role,
        password: editData.password ? editData.password : undefined,
      });

      setSuccessMsg('Manager details updated successfully.');
      setEditModalOpen(false);
      fetchManagers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating manager.');
    }
  };

  const handleToggleStatus = async (manager) => {
    clearMessages();
    const nextStatus = !manager.isActive;

    try {
      await api.patch(`/admin/managers/${manager._id}/status`, {
        isActive: nextStatus,
      });

      setSuccessMsg(`Manager ${manager.name} has been ${nextStatus ? 'activated' : 'deactivated'}.`);
      fetchManagers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update manager status.');
    }
  };

  const handleDelete = async (manager) => {
    if (!window.confirm(`Are you sure you want to delete manager account for ${manager.name} (${manager.email})?`)) {
      return;
    }

    clearMessages();
    try {
      await api.delete(`/admin/managers/${manager._id}`);
      setSuccessMsg(`Manager account deleted successfully.`);
      fetchManagers();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete manager.');
    }
  };

  const openEdit = (manager) => {
    clearMessages();
    setEditData({
      id: manager._id,
      name: manager.name || '',
      phone: manager.phone || '',
      role: manager.role || 'bus_manager',
      password: '',
    });
    setEditModalOpen(true);
  };

  const busManagers = managers.filter((m) => {
    const r = (m.role || '').toLowerCase();
    return r === 'bus_manager' || r === 'manager';
  });
  const bookingManagers = managers.filter((m) => (m.role || '').toLowerCase() === 'booking_manager');
  const financeManagers = managers.filter((m) => (m.role || '').toLowerCase() === 'finance_manager');

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header admin-panel-header-inline">
        <div>
          <h3>Manager Account Management</h3>
          <p className="text-sm text-slate-400">
            Create, oversee, and control permissions for the 3 operational manager roles.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-btn primary flex items-center gap-2"
          onClick={() => {
            clearMessages();
            setFormData(initialForm);
            setModalOpen(true);
          }}
        >
          <Plus size={16} />
          Create New Manager
        </button>
      </div>

      {errorMsg && (
        <div className="admin-alert admin-alert-danger flex items-center gap-2 mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="admin-alert admin-alert-success flex items-center gap-2 mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="admin-summary-grid compact-grid mb-6">
        <div className="admin-stat-card admin-stat-card--violet">
          <div className="admin-stat-icon">👥</div>
          <div>
            <span className="admin-stat-label">Total Managers</span>
            <h3>{managers.length}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--blue">
          <div className="admin-stat-icon">🚌</div>
          <div>
            <span className="admin-stat-label">Operations Managers</span>
            <h3>{busManagers.length}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--emerald">
          <div className="admin-stat-icon">📋</div>
          <div>
            <span className="admin-stat-label">Booking Managers</span>
            <h3>{bookingManagers.length}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--amber">
          <div className="admin-stat-icon">💳</div>
          <div>
            <span className="admin-stat-label">Finance Managers</span>
            <h3>{financeManagers.length}</h3>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading managers...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Manager</th>
                <th>Role & Scope</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Created</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {managers.length ? (
                managers.map((manager) => {
                  const roleKey = (manager.role || '').toLowerCase();
                  const meta = roleMeta[roleKey] || roleMeta[manager.role] || {
                    label: manager.role,
                    badgeClass: 'status-pill info',
                    description: '',
                  };

                  return (
                    <tr key={manager._id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="admin-user-avatar">
                            {(manager.name || 'M').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong className="block text-slate-100">{manager.name}</strong>
                            <span className="text-xs text-slate-400">{manager.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={meta.badgeClass}>{meta.label}</span>
                        <div className="text-xs text-slate-500 mt-1">{meta.description}</div>
                      </td>
                      <td>
                        <span className="text-sm text-slate-300">{manager.phone || 'No phone'}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${manager.isActive !== false ? 'success' : 'danger'}`}>
                          {manager.isActive !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className="text-xs text-slate-400">
                          {manager.createdAt ? new Date(manager.createdAt).toLocaleDateString() : '-'}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className="admin-icon-button"
                            title="Edit Manager"
                            onClick={() => openEdit(manager)}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className={`admin-icon-button ${manager.isActive !== false ? 'text-emerald-400' : 'text-amber-400'}`}
                            title={manager.isActive !== false ? 'Deactivate Account' : 'Activate Account'}
                            onClick={() => handleToggleStatus(manager)}
                          >
                            {manager.isActive !== false ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                          </button>
                          <button
                            type="button"
                            className="admin-icon-button text-rose-400 hover:text-rose-300"
                            title="Delete Manager"
                            onClick={() => handleDelete(manager)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="empty-cell text-center p-8 text-slate-400">
                    No manager accounts created yet. Click "Create New Manager" above to provision one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* CREATE MANAGER MODAL */}
      {modalOpen && (
        <div className="admin-modal-backdrop fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="admin-modal bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-indigo-400" size={20} />
                <h3 className="text-lg font-semibold text-slate-100">Create Staff Manager Account</h3>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => setModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email Address (Login ID) *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. operations@busbook.com"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Manager Role *</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                >
                  <option value="bus_manager">Bus Operations Manager (Fleet, Routes, Fares)</option>
                  <option value="booking_manager">Booking Manager (Bookings, Cancellations, Emergencies)</option>
                  <option value="finance_manager">Finance Manager (Transactions, Revenue, Reports)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="Confirm password"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-indigo-500"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium shadow-md"
                >
                  Save Manager
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MANAGER MODAL */}
      {editModalOpen && (
        <div className="admin-modal-backdrop fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="admin-modal bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-slate-100">Edit Manager Account</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => setEditModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Role</label>
                <select
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm"
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                >
                  <option value="bus_manager">Bus Operations Manager</option>
                  <option value="booking_manager">Booking Manager</option>
                  <option value="finance_manager">Finance Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reset Password <span className="text-slate-500 font-normal">(leave blank to keep unchanged)</span>
                </label>
                <input
                  type="password"
                  placeholder="New password (optional)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-slate-100 text-sm"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium"
                >
                  Update Details
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagers;
