import { useEffect, useState } from 'react';
import api from '../../services/api';

const AdminEmergency = () => {
  const [emergencyBookings, setEmergencyBookings] = useState([]);

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/admin/emergency');
      setEmergencyBookings(response.data.emergencyBookings || []);
    };

    load();
  }, []);

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header">
        <h3>Emergency Reservations</h3>
      </div>

      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Passenger</th>
              <th>Route</th>
              <th>Priority</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {emergencyBookings.length ? emergencyBookings.map((booking) => (
              <tr key={booking._id}>
                <td>{booking.user?.name || 'Guest'}</td>
                <td>{booking.from || '-'} → {booking.to || '-'}</td>
                <td>{booking.priorityLevel || 'normal'}</td>
                <td>{booking.emergencyReason || 'Other'}</td>
                <td><span className="status-pill success">{booking.paymentStatus || booking.status}</span></td>
              </tr>
            )) : <tr><td colSpan="5" className="empty-cell">No emergency bookings found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminEmergency;
