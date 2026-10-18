import { useEffect, useState } from 'react';
import api from '../../services/api';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
    };

    load();
  }, []);

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header">
        <h3>Users</h3>
      </div>
      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Bookings</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.length ? users.map((user) => (
              <tr key={user._id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.phone || '-'}</td>
                <td><span className="status-pill info">{user.role || 'user'}</span></td>
                <td>{user.bookingCount ?? 0}</td>
                <td>{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            )) : <tr><td colSpan="6" className="empty-cell">No users available.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsers;
