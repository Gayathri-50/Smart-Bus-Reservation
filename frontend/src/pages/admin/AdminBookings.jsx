import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const AdminBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/admin/bookings');
      setBookings(response.data.bookings || []);
    };

    load();
  }, []);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const matchesStatus = statusFilter === 'all' || (booking.status || '').toLowerCase() === statusFilter.toLowerCase() || (booking.paymentStatus || '').toLowerCase() === statusFilter.toLowerCase();
      const searchValue = `${booking.busName || ''} ${booking.from || ''} ${booking.to || ''} ${booking.passengerDetails?.[0]?.name || ''}`.toLowerCase();
      const matchesSearch = searchValue.includes(searchTerm.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [bookings, statusFilter, searchTerm]);

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header admin-panel-header-inline">
        <h3>Booking Management</h3>
      </div>

      <div className="admin-toolbar">
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search bookings" />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Passenger</th>
              <th>Bus</th>
              <th>Route</th>
              <th>Seats</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredBookings.length ? filteredBookings.map((booking) => (
              <tr key={booking._id}>
                <td>{booking._id.slice(-8)}</td>
                <td>{booking.passengerDetails?.[0]?.name || 'Guest'}</td>
                <td>{booking.busName || booking.bus?.busName || 'Bus'}</td>
                <td>{booking.from || '-'} → {booking.to || '-'}</td>
                <td>{booking.seats?.join(', ') || '-'}</td>
                <td>₹{booking.totalAmount || 0}</td>
                <td><span className="status-pill success">{booking.paymentStatus || booking.status}</span></td>
              </tr>
            )) : <tr><td colSpan="7" className="empty-cell">No bookings available.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBookings;
