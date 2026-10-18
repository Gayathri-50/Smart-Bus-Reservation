import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Eye,
  RefreshCw,
  Search,
  User,
  X,
  XCircle,
} from 'lucide-react';
import api from '../../services/api';

const ManagerBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/bookings');
      setBookings(res.data.bookings || []);
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to load bookings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      setActionLoading(true);
      setFeedback({ type: '', message: '' });
      await api.patch(`/admin/bookings/${bookingId}/status`, { status: newStatus });
      setFeedback({
        type: 'success',
        message: `Booking status updated to ${newStatus}.`,
      });
      if (selectedBooking && selectedBooking._id === bookingId) {
        setSelectedBooking({ ...selectedBooking, status: newStatus });
      }
      fetchBookings();
    } catch (err) {
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to update booking status.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (b.status || '').toLowerCase() === statusFilter.toLowerCase();

      const term = searchTerm.toLowerCase();
      const passengerName = b.passengerDetails?.[0]?.name || b.user?.name || '';
      const busName = b.busName || b.bus?.busName || '';
      const route = `${b.from || ''} ${b.to || ''}`.toLowerCase();
      const id = String(b._id || '').toLowerCase();

      const matchesSearch =
        passengerName.toLowerCase().includes(term) ||
        busName.toLowerCase().includes(term) ||
        route.includes(term) ||
        id.includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [bookings, statusFilter, searchTerm]);

  const summary = {
    total: bookings.length,
    confirmed: bookings.filter((b) => (b.status || '').toLowerCase() === 'confirmed').length,
    pending: bookings.filter((b) => (b.status || '').toLowerCase() === 'pending').length,
    cancelled: bookings.filter((b) => (b.status || '').toLowerCase() === 'cancelled').length,
  };

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header admin-panel-header-inline">
        <div>
          <h3>Booking Operations & Reservations</h3>
          <p className="text-sm text-slate-400">
            View customer reservations, inspect passenger tickets, confirm seats, or handle cancellations.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-btn flex items-center gap-2"
          onClick={fetchBookings}
        >
          <RefreshCw size={15} />
          Refresh
        </button>
      </div>

      {feedback.message && (
        <div
          className={`admin-alert ${
            feedback.type === 'success' ? 'admin-alert-success bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'admin-alert-danger bg-rose-500/10 text-rose-300 border-rose-500/30'
          } flex items-center gap-2 mb-4 p-3 rounded-lg border`}
        >
          {feedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="admin-summary-grid compact-grid mb-6">
        <div className="admin-stat-card admin-stat-card--violet">
          <div className="admin-stat-icon">📋</div>
          <div>
            <span className="admin-stat-label">Total Reservations</span>
            <h3>{summary.total}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--emerald">
          <div className="admin-stat-icon">✓</div>
          <div>
            <span className="admin-stat-label">Confirmed</span>
            <h3>{summary.confirmed}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--amber">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <span className="admin-stat-label">Pending</span>
            <h3>{summary.pending}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--danger">
          <div className="admin-stat-icon">✕</div>
          <div>
            <span className="admin-stat-label">Cancelled</span>
            <h3>{summary.cancelled}</h3>
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="relative flex-1">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Passenger, Bus, Route or Booking ID..."
            className="w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter booking status"
        >
          <option value="all">All Statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="admin-panel">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading reservations...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Booking ID</th>
                <th>Passenger</th>
                <th>Bus & Route</th>
                <th>Seats</th>
                <th>Amount</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length ? (
                filteredBookings.map((b) => (
                  <tr key={b._id}>
                    <td>
                      <span className="font-mono text-xs text-indigo-300">
                        #{b._id.slice(-8).toUpperCase()}
                      </span>
                      {b.bookingType === 'emergency' && (
                        <span className="ml-2 text-xs text-rose-400 font-semibold">🚨 Priority</span>
                      )}
                    </td>
                    <td>
                      <strong className="block text-slate-200">
                        {b.passengerDetails?.[0]?.name || b.user?.name || 'Passenger'}
                      </strong>
                      <span className="text-xs text-slate-400">
                        {b.passengerDetails?.[0]?.phone || b.user?.phone || b.user?.email || '-'}
                      </span>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-slate-200">
                        {b.busName || b.bus?.busName || 'Bus'}
                      </div>
                      <span className="text-xs text-slate-400">
                        {b.from} → {b.to}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs font-semibold px-2 py-1 bg-slate-800 rounded border border-slate-700 text-slate-200">
                        {((b.seats && b.seats.length ? b.seats : b.seatNumbers) || []).join(', ') || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <span className="font-medium text-slate-100">
                        ₹{b.totalAmount || b.fare || 0}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          (b.status || '').toLowerCase() === 'confirmed'
                            ? 'success'
                            : (b.status || '').toLowerCase() === 'cancelled'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {b.status || 'PENDING'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="admin-icon-button"
                          title="View Details"
                          onClick={() => setSelectedBooking(b)}
                        >
                          <Eye size={15} />
                        </button>
                        {(b.status || '').toLowerCase() !== 'confirmed' && (
                          <button
                            type="button"
                            className="admin-icon-button text-emerald-400"
                            title="Confirm Booking"
                            onClick={() => handleStatusUpdate(b._id, 'confirmed')}
                            disabled={actionLoading}
                          >
                            <CheckCircle size={15} />
                          </button>
                        )}
                        {(b.status || '').toLowerCase() !== 'cancelled' && (
                          <button
                            type="button"
                            className="admin-icon-button text-rose-400"
                            title="Cancel Booking"
                            onClick={() => handleStatusUpdate(b._id, 'cancelled')}
                            disabled={actionLoading}
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-cell text-center p-8 text-slate-400">
                    No reservations matched your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedBooking && (
        <div className="admin-modal-backdrop fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="admin-modal bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-semibold text-slate-100">
                Reservation #{selectedBooking._id.slice(-8).toUpperCase()}
              </h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-200"
                onClick={() => setSelectedBooking(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Route:</span>
                <span className="font-semibold text-slate-200">
                  {selectedBooking.from} → {selectedBooking.to}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Journey Date:</span>
                <span>
                  {selectedBooking.travelDate || selectedBooking.journeyDate
                    ? new Date(selectedBooking.travelDate || selectedBooking.journeyDate).toLocaleDateString()
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Bus:</span>
                <span>{selectedBooking.busName || selectedBooking.bus?.busName || 'Express'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Seats:</span>
                <span className="font-mono text-indigo-300 font-semibold">
                  {((selectedBooking.seats && selectedBooking.seats.length ? selectedBooking.seats : selectedBooking.seatNumbers) || []).join(', ') || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Passenger Name:</span>
                <span className="text-slate-200 font-medium">
                  {selectedBooking.passengerDetails?.[0]?.name || selectedBooking.user?.name || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Email:</span>
                <span>
                  {selectedBooking.passengerDetails?.[0]?.email || selectedBooking.user?.email || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Phone:</span>
                <span>
                  {selectedBooking.passengerDetails?.[0]?.phone || selectedBooking.user?.phone || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Fare:</span>
                <span className="text-emerald-400 font-bold">
                  ₹{selectedBooking.totalAmount || selectedBooking.fare || 0}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Current Status:</span>
                <span className="capitalize font-semibold">{selectedBooking.status}</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-5 border-t border-slate-800 mt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium"
                  onClick={() => handleStatusUpdate(selectedBooking._id, 'confirmed')}
                  disabled={actionLoading}
                >
                  Mark Confirmed
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium"
                  onClick={() => handleStatusUpdate(selectedBooking._id, 'cancelled')}
                  disabled={actionLoading}
                >
                  Cancel Booking
                </button>
              </div>
              <button
                type="button"
                className="px-4 py-1.5 text-slate-300 hover:text-white text-xs"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerBookings;
