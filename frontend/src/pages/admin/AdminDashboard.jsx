import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Banknote, BusFront, Wallet, Users } from 'lucide-react';
import api from '../../services/api';

const statMeta = [
  { key: 'totalUsers', label: 'Total Users', icon: Users, tone: 'violet' },
  { key: 'totalBuses', label: 'Total Buses', icon: BusFront, tone: 'blue' },
  { key: 'todaysBookings', label: "Today's Bookings", icon: ArrowUpRight, tone: 'emerald' },
  { key: 'totalRevenue', label: 'Total Revenue', icon: Wallet, tone: 'amber' },
];

const formatCurrency = (value = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const AdminDashboard = () => {
  const [stats, setStats] = useState({ totalUsers: 0, totalBuses: 0, todaysBookings: 0, totalRevenue: 0 });
  const [analytics, setAnalytics] = useState({ bookingsOverTime: [], revenueOverTime: [], popularRoutes: [], userRegistrations: [] });
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashboardRes, analyticsRes, bookingsRes, usersRes] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/analytics'),
          api.get('/admin/bookings'),
          api.get('/admin/users'),
        ]);

        setStats(dashboardRes.data.stats || {});
        setAnalytics(analyticsRes.data.analytics || {});
        setRecentBookings((bookingsRes.data.bookings || []).slice(0, 5));
        setRecentUsers((usersRes.data.users || []).slice(0, 5));
      } catch (error) {
        console.error('Failed to load admin dashboard data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const bookingBars = useMemo(() => {
    const values = analytics.bookingsOverTime?.map((entry) => entry.count) || [];
    const max = Math.max(...values, 1);
    return analytics.bookingsOverTime || [];
  }, [analytics]);

  const revenueBars = useMemo(() => {
    const values = analytics.revenueOverTime?.map((entry) => entry.revenue) || [];
    const max = Math.max(...values, 1);
    return analytics.revenueOverTime || [];
  }, [analytics]);

  if (loading) {
    return <div className="admin-stat-card loading-card">Loading dashboard...</div>;
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-summary-grid">
        {statMeta.map(({ key, label, icon: Icon, tone }) => (
          <div key={key} className={`admin-stat-card admin-stat-card--${tone}`}>
            <div className="admin-stat-icon"><Icon size={18} /></div>
            <div>
              <span className="admin-stat-label">{label}</span>
              <h3>{key === 'totalRevenue' ? formatCurrency(stats[key]) : stats[key] ?? 0}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-surface-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3>Booking Overview</h3>
          </div>
          <div className="chart-bars">
            {bookingBars.length ? bookingBars.map((entry) => (
              <div key={entry._id} className="chart-column-wrap">
                <div className="chart-column" style={{ height: `${(entry.count / Math.max(...bookingBars.map((item) => item.count), 1)) * 100}%` }} />
                <small>{entry._id.slice(5)}</small>
              </div>
            )) : <div className="empty-chart-state">No bookings yet.</div>}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3>Revenue</h3>
          </div>
          <div className="chart-bars">
            {revenueBars.length ? revenueBars.map((entry) => (
              <div key={entry._id} className="chart-column-wrap">
                <div className="chart-column revenue" style={{ height: `${(entry.revenue / Math.max(...revenueBars.map((item) => item.revenue), 1)) * 100}%` }} />
                <small>{entry._id.slice(5)}</small>
              </div>
            )) : <div className="empty-chart-state">No revenue data yet.</div>}
          </div>
        </div>
      </div>

      <div className="admin-secondary-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3>Recent Bookings</h3>
          </div>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Passenger</th>
                <th>Route</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBookings.length ? recentBookings.map((booking) => (
                <tr key={booking._id}>
                  <td>{booking.passengerDetails?.[0]?.name || 'Guest'}</td>
                  <td>{booking.from || '-'} → {booking.to || '-'}</td>
                  <td>{formatCurrency(booking.totalAmount || 0)}</td>
                  <td><span className="status-pill success">{booking.paymentStatus || booking.status}</span></td>
                </tr>
              )) : <tr><td colSpan="4" className="empty-cell">No recent bookings found.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3>Popular Routes</h3>
          </div>
          <div className="mini-list compact-list">
            {(analytics.popularRoutes || []).length ? analytics.popularRoutes.map((route) => (
              <div key={route._id} className="mini-list-row">
                <span>{route._id}</span>
                <strong>{route.count}</strong>
              </div>
            )) : <div className="empty-state">No route data available.</div>}
          </div>
        </div>
      </div>

      <div className="admin-secondary-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3>Bus Occupancy</h3>
          </div>
          <div className="mini-list">
            <div className="mini-list-row"><span>Available</span><strong>—</strong></div>
            <div className="mini-list-row"><span>Booked</span><strong>—</strong></div>
            <div className="mini-list-row"><span>Capacity</span><strong>—</strong></div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3>Recent User Registrations</h3>
          </div>
          <div className="mini-list compact-list">
            {recentUsers.length ? recentUsers.map((user) => (
              <div key={user._id} className="mini-list-row">
                <span>{user.name}</span>
                <strong>{new Date(user.createdAt).toLocaleDateString()}</strong>
              </div>
            )) : <div className="empty-state">No users yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
