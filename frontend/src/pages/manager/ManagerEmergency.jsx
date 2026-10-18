import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw, ShieldAlert, XCircle } from 'lucide-react';
import api from '../../services/api';

const ManagerEmergency = () => {
  const [emergencyBookings, setEmergencyBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const fetchEmergency = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/emergency');
      setEmergencyBookings(res.data.emergencyBookings || []);
    } catch (err) {
      console.error('Failed to load emergency bookings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmergency();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/emergency/${id}/status`, { status });
      setMsg(`Emergency request marked as ${status}.`);
      fetchEmergency();
    } catch (err) {
      setMsg(err.response?.data?.message || 'Failed to update emergency status.');
    }
  };

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header admin-panel-header-inline">
        <div>
          <h3>Emergency & Priority Booking Dispatch</h3>
          <p className="text-sm text-slate-400">
            Urgent requests requiring expedited review and emergency quota allocation.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-btn flex items-center gap-2"
          onClick={fetchEmergency}
        >
          <RefreshCw size={15} />
          Refresh Requests
        </button>
      </div>

      {msg && (
        <div className="p-3 mb-4 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-sm">
          {msg}
        </div>
      )}

      <div className="admin-panel">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading emergency queue...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Route & Bus</th>
                <th>Priority</th>
                <th>Reason</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {emergencyBookings.length ? (
                emergencyBookings.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <strong className="block text-slate-200">{b.user?.name || 'Guest'}</strong>
                      <span className="text-xs text-slate-400">{b.user?.phone || b.user?.email || '-'}</span>
                    </td>
                    <td>
                      <div className="text-sm text-slate-200">
                        {b.from || '-'} → {b.to || '-'}
                      </div>
                      <span className="text-xs text-slate-400">{b.bus?.busName || 'Emergency Bus'}</span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          (b.priorityLevel || '').toLowerCase() === 'high' ||
                          (b.priorityLevel || '').toLowerCase() === 'critical'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {b.priorityLevel || 'High Priority'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-300 max-w-xs block truncate">
                        {b.emergencyReason || 'Medical / Urgent Travel'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          (b.status || '').toLowerCase() === 'confirmed' ||
                          (b.status || '').toLowerCase() === 'approved'
                            ? 'success'
                            : 'warning'
                        }`}
                      >
                        {b.status || 'Pending'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="admin-icon-button text-emerald-400"
                          title="Approve / Confirm"
                          onClick={() => handleUpdateStatus(b._id, 'confirmed')}
                        >
                          <CheckCircle size={15} />
                        </button>
                        <button
                          type="button"
                          className="admin-icon-button text-rose-400"
                          title="Reject / Cancel"
                          onClick={() => handleUpdateStatus(b._id, 'cancelled')}
                        >
                          <XCircle size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-cell text-center p-8 text-slate-400">
                    No active emergency requests in the queue.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ManagerEmergency;
