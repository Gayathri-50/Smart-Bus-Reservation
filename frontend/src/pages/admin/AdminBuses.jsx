import { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bus,
  CheckCircle,
  MapPin,
  Pencil,
  Play,
  Plus,
  Radio,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import api from '../../services/api';

const emptyForm = {
  busName: '',
  operator: '',
  busType: 'AC Sleeper',
  from: '',
  to: '',
  departureTime: '',
  arrivalTime: '',
  totalSeats: 40,
  availableSeats: 40,
  fare: 0,
  status: 'active',
};

const AdminBuses = () => {
  const [buses, setBuses] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingBusId, setEditingBusId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingBusId, setLoadingBusId] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Start Journey Modal State
  const [startModalBus, setStartModalBus] = useState(null);
  const [startLocation, setStartLocation] = useState('');

  // Confirmation Modal State (replaces window.confirm)
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchBuses = async () => {
    try {
      const response = await api.get('/admin/buses');
      setBuses(response.data.buses || []);
    } catch (error) {
      console.error('Failed to load buses', error);
    }
  };

  useEffect(() => {
    fetchBuses();
  }, []);

  const openAddModal = () => {
    setForm(emptyForm);
    setEditingBusId(null);
    setShowModal(true);
  };

  const openEditModal = (bus) => {
    setForm({
      busName: bus.busName || '',
      operator: bus.operator || '',
      busType: bus.busType || 'AC Sleeper',
      from: bus.from || '',
      to: bus.to || '',
      departureTime: bus.departureTime || '',
      arrivalTime: bus.arrivalTime || '',
      totalSeats: bus.totalSeats || 40,
      availableSeats: bus.availableSeats || 40,
      fare: bus.fare || 0,
      status: bus.status || 'active',
    });
    setEditingBusId(bus._id);
    setShowModal(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const payload = {
        ...form,
        totalSeats: Number(form.totalSeats),
        availableSeats: Number(form.availableSeats),
        fare: Number(form.fare),
      };

      if (editingBusId) {
        await api.put(`/admin/buses/${editingBusId}`, payload);
        setFeedback({ type: 'success', text: `✓ Bus ${payload.busName} updated successfully.` });
      } else {
        await api.post('/admin/buses', payload);
        setFeedback({ type: 'success', text: `✓ New bus ${payload.busName} added successfully.` });
      }
      setShowModal(false);
      setForm(emptyForm);
      fetchBuses();
    } catch (error) {
      console.error('Failed to save bus', error);
      setFeedback({ type: 'error', text: 'Failed to save bus. Please try again.' });
    }
  };

  // Delete Bus Dialog
  const handleDeleteClick = (bus) => {
    setConfirmDialog({
      title: 'Delete Bus Fleet?',
      message: `Are you sure you want to permanently delete "${bus.busName}" (${bus.from} → ${bus.to})?`,
      confirmText: 'Delete Bus',
      confirmClass: 'danger-btn',
      onConfirm: async () => {
        try {
          await api.delete(`/admin/buses/${bus._id}`);
          setFeedback({ type: 'success', text: `✓ Bus ${bus.busName} removed successfully.` });
          fetchBuses();
        } catch (error) {
          console.error('Failed to delete bus', error);
          setFeedback({ type: 'error', text: 'Failed to delete bus.' });
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  // Open Start Journey Modal
  const openStartModal = (bus) => {
    setStartModalBus(bus);
    setStartLocation(bus.from || '');
  };

  // Execute Start Bus Journey & Send Alerts to All Guardians
  const handleConfirmStartJourney = async () => {
    if (!startModalBus) return;
    const bus = startModalBus;
    const location = startLocation.trim() || bus.from;

    try {
      setLoadingBusId(bus._id);
      const res = await api.post(`/buses/${bus._id}/start-journey`, {
        currentLocation: location,
      });

      setFeedback({
        type: 'success',
        text: res.data.message || `✓ ${bus.busName} journey started! Live status messages dispatched to guardians.`,
      });
      setStartModalBus(null);
      fetchBuses();
    } catch (error) {
      console.error('Failed to start bus journey', error);
      setFeedback({
        type: 'error',
        text: error.response?.data?.message || 'Failed to start bus journey.',
      });
    } finally {
      setLoadingBusId(null);
    }
  };

  // End / Complete Bus Journey Dialog
  const handleCompleteTripClick = (bus) => {
    setConfirmDialog({
      title: 'Complete Journey?',
      message: `Mark journey for "${bus.busName}" (${bus.from} → ${bus.to}) as COMPLETED?`,
      confirmText: 'End Trip & Complete',
      confirmClass: 'primary-btn',
      onConfirm: async () => {
        try {
          setLoadingBusId(bus._id);
          const res = await api.patch(`/buses/${bus._id}/status`, { status: 'COMPLETED' });
          setFeedback({
            type: 'success',
            text: res.data.message || `✓ Trip marked as completed for ${bus.busName}.`,
          });
          fetchBuses();
        } catch (error) {
          console.error('Failed to complete trip', error);
          setFeedback({
            type: 'error',
            text: error.response?.data?.message || 'Failed to update bus status.',
          });
        } finally {
          setLoadingBusId(null);
          setConfirmDialog(null);
        }
      },
    });
  };

  // Reset Trip back to Scheduled
  const handleResetTrip = async (bus) => {
    try {
      setLoadingBusId(bus._id);
      await api.patch(`/buses/${bus._id}/status`, { status: 'SCHEDULED' });
      setFeedback({
        type: 'info',
        text: `Trip status reset to Scheduled for ${bus.busName}.`,
      });
      fetchBuses();
    } catch (error) {
      console.error('Failed to reset trip', error);
    } finally {
      setLoadingBusId(null);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <div className="admin-page-block">
      {/* Top Header */}
      <div className="admin-panel-header admin-panel-header-inline">
        <div>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bus size={22} style={{ color: '#818cf8' }} /> Bus Fleet & Journey Operations
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Configure fleets, monitor live journey progress, and trigger automated guardian safety notifications.
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={openAddModal}>
          <Plus size={16} /> Add Bus
        </button>
      </div>

      {feedback && (
        <div className={`admin-alert-banner ${feedback.type}`}>
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="admin-panel" style={{ overflow: 'hidden' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Bus Name & Operator</th>
              <th>Route</th>
              <th>Timings</th>
              <th>Fare</th>
              <th>Capacity</th>
              <th>Fleet</th>
              <th>Trip Status</th>
              <th>Operations</th>
            </tr>
          </thead>
          <tbody>
            {buses.length ? (
              buses.map((bus) => {
                const isStarted = bus.tripStatus === 'STARTED';
                const isCompleted = bus.tripStatus === 'COMPLETED';
                const isLoading = loadingBusId === bus._id;

                return (
                  <tr key={bus._id}>
                    <td>
                      <strong style={{ color: '#f1f5f9' }}>{bus.busName}</strong>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {bus.operator || 'Express'} · {bus.busType || 'AC'}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{bus.from} → {bus.to}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px', color: '#38bdf8' }}>{bus.departureTime} dep</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{bus.arrivalTime} arr</div>
                    </td>
                    <td>
                      <strong style={{ color: '#34d399' }}>₹{bus.fare}</strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px' }}>
                        {bus.availableSeats} / {bus.totalSeats || 40}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill ${bus.status === 'active' ? 'success' : 'danger'}`}>
                        {bus.status || 'active'}
                      </span>
                    </td>
                    <td>
                      {isStarted ? (
                        <div>
                          <span className="status-pill in-transit">
                            <span className="pulse-dot"></span> In Transit
                          </span>
                          {bus.currentLocation && (
                            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <MapPin size={10} style={{ color: '#38bdf8' }} /> {bus.currentLocation}
                            </div>
                          )}
                        </div>
                      ) : isCompleted ? (
                        <span className="status-pill info">🏁 Completed</span>
                      ) : (
                        <span className="status-pill success">📅 Scheduled</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {/* Journey Control Button */}
                        {isStarted ? (
                          <button
                            type="button"
                            className="action-btn-sm warning"
                            title="End trip & complete journey"
                            onClick={() => handleCompleteTripClick(bus)}
                            disabled={isLoading}
                          >
                            <CheckCircle size={13} /> {isLoading ? 'Updating...' : 'End Trip'}
                          </button>
                        ) : isCompleted ? (
                          <button
                            type="button"
                            className="action-btn-sm secondary"
                            title="Reset trip status back to Scheduled"
                            onClick={() => handleResetTrip(bus)}
                            disabled={isLoading}
                          >
                            <RotateCcw size={13} /> {isLoading ? '...' : 'Reset'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="action-btn-sm success"
                            title="Start bus journey & dispatch live status update to passenger guardians"
                            onClick={() => openStartModal(bus)}
                            disabled={isLoading}
                          >
                            <Play size={13} /> Start Bus
                          </button>
                        )}

                        <button
                          type="button"
                          className="icon-btn"
                          title="Edit Bus Details"
                          onClick={() => openEditModal(bus)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn danger"
                          title="Delete Bus"
                          onClick={() => handleDeleteClick(bus)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="empty-cell">
                  No buses registered in the system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* =====================================================================
          START BUS JOURNEY & NOTIFY GUARDIANS MODAL
         ===================================================================== */}
      {startModalBus && (
        <div className="modal-backdrop" onClick={() => setStartModalBus(null)}>
          <div
            className="admin-modal"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Play size={18} style={{ color: '#34d399' }} /> Start Bus Journey
              </h3>
              <button
                type="button"
                onClick={() => setStartModalBus(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '16px 0' }}>
              {/* Bus Details Summary */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(148, 163, 184, 0.18)',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9' }}>
                  {startModalBus.busName}
                </div>
                <div style={{ fontSize: '13px', color: '#38bdf8', marginTop: '4px' }}>
                  {startModalBus.from} → {startModalBus.to} ({startModalBus.departureTime} Departure)
                </div>
              </div>

              {/* Location Input */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#cbd5e1', fontSize: '13px', marginBottom: '16px' }}>
                <span style={{ fontWeight: 600 }}>Departure / Current Location</span>
                <input
                  type="text"
                  value={startLocation}
                  onChange={(e) => setStartLocation(e.target.value)}
                  placeholder="e.g. Swargate Terminal, Pune"
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(148, 163, 184, 0.25)',
                    borderRadius: '10px',
                    padding: '11px 14px',
                    color: '#fff',
                    fontSize: '14px',
                  }}
                  required
                />
              </label>

              {/* Safety Guardian Notification Notice */}
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(52, 211, 153, 0.3)',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  color: '#6ee7b7',
                  fontSize: '13px',
                  lineHeight: '1.5',
                }}
              >
                <ShieldCheck size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#34d399' }} />
                <div>
                  <strong>Automated Guardian Alerts Active:</strong> Live Email and WhatsApp status updates will be dispatched immediately to guardians of all booked passengers.
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '8px' }}>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setStartModalBus(null)}
                disabled={loadingBusId === startModalBus._id}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none' }}
                onClick={handleConfirmStartJourney}
                disabled={loadingBusId === startModalBus._id}
              >
                {loadingBusId === startModalBus._id ? 'Starting Journey...' : '🚀 Confirm & Start Bus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CONFIRMATION DIALOG (Delete / Complete)
         ===================================================================== */}
      {confirmDialog && (
        <div className="modal-backdrop" onClick={() => setConfirmDialog(null)}>
          <div
            className="admin-modal"
            style={{ maxWidth: '440px', padding: '24px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: confirmDialog.confirmClass === 'danger-btn' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                  display: 'grid',
                  placeItems: 'center',
                  color: confirmDialog.confirmClass === 'danger-btn' ? '#fca5a5' : '#a5b4fc',
                }}
              >
                <AlertCircle size={22} />
              </div>
              <h3 style={{ margin: 0, color: '#fff', fontSize: '1.15rem' }}>{confirmDialog.title}</h3>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: '1.5', margin: '0 0 20px' }}>
              {confirmDialog.message}
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="secondary-btn" onClick={() => setConfirmDialog(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={confirmDialog.confirmClass === 'danger-btn' ? 'primary-btn' : 'primary-btn'}
                style={confirmDialog.confirmClass === 'danger-btn' ? { background: '#dc2626', borderColor: '#ef4444' } : {}}
                onClick={confirmDialog.onConfirm}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ADD / EDIT BUS MODAL
         ===================================================================== */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="admin-modal" onClick={(event) => event.stopPropagation()}>
            <div className="admin-panel-header">
              <h3>{editingBusId ? 'Edit Bus Fleet' : 'Register New Bus Fleet'}</h3>
            </div>

            <form onSubmit={handleSubmit} className="admin-form-grid">
              <label>
                Bus Name
                <input name="busName" value={form.busName} onChange={handleChange} placeholder="e.g. Shivneri Express" required />
              </label>
              <label>
                Operator
                <input name="operator" value={form.operator} onChange={handleChange} placeholder="e.g. MSRTC Travels" required />
              </label>
              <label>
                Bus Type
                <input name="busType" value={form.busType} onChange={handleChange} placeholder="e.g. AC Luxury Sleeper" required />
              </label>
              <label>
                Departure City (From)
                <input name="from" value={form.from} onChange={handleChange} placeholder="e.g. Pune" required />
              </label>
              <label>
                Destination City (To)
                <input name="to" value={form.to} onChange={handleChange} placeholder="e.g. Mumbai" required />
              </label>
              <label>
                Departure Time
                <input name="departureTime" value={form.departureTime} onChange={handleChange} placeholder="e.g. 07:00 AM" required />
              </label>
              <label>
                Arrival Time
                <input name="arrivalTime" value={form.arrivalTime} onChange={handleChange} placeholder="e.g. 11:30 AM" required />
              </label>
              <label>
                Total Seats
                <input type="number" name="totalSeats" value={form.totalSeats} onChange={handleChange} required />
              </label>
              <label>
                Available Seats
                <input type="number" name="availableSeats" value={form.availableSeats} onChange={handleChange} required />
              </label>
              <label>
                Fare (₹ INR)
                <input type="number" name="fare" value={form.fare} onChange={handleChange} required />
              </label>
              <label>
                Fleet Status
                <select name="status" value={form.status} onChange={handleChange}>
                  <option value="active">Active (In Service)</option>
                  <option value="inactive">Inactive (Maintenance)</option>
                </select>
              </label>

              <div className="modal-actions" style={{ gridColumn: 'span 2' }}>
                <button type="button" className="secondary-btn" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {editingBusId ? 'Update Bus Details' : 'Save & Register Bus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBuses;
