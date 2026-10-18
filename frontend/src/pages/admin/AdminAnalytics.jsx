import { useEffect, useState } from 'react';
import api from '../../services/api';

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState({
    bookingsOverTime: [],
    revenueOverTime: [],
    popularRoutes: [],
    userRegistrations: [],
  });

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/admin/analytics');
      setAnalytics(response.data.analytics || {});
    };

    load();
  }, []);

  return (
    <div className="admin-page-block">
      <div className="admin-surface-grid">
        <div className="admin-panel">
          <div className="admin-panel-header"><h3>Bookings over time</h3></div>
          <div className="mini-list">
            {analytics.bookingsOverTime?.length ? analytics.bookingsOverTime.map((entry) => (
              <div key={entry._id} className="mini-list-row"><span>{entry._id}</span><strong>{entry.count}</strong></div>
            )) : <p className="empty-state">No booking analytics yet.</p>}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header"><h3>Revenue over time</h3></div>
          <div className="mini-list">
            {analytics.revenueOverTime?.length ? analytics.revenueOverTime.map((entry) => (
              <div key={entry._id} className="mini-list-row"><span>{entry._id}</span><strong>₹{entry.revenue || 0}</strong></div>
            )) : <p className="empty-state">No revenue analytics yet.</p>}
          </div>
        </div>
      </div>

      <div className="admin-surface-grid">
        <div className="admin-panel">
          <div className="admin-panel-header"><h3>Popular Routes</h3></div>
          <div className="mini-list">
            {analytics.popularRoutes?.length ? analytics.popularRoutes.map((route) => (
              <div key={route._id} className="mini-list-row"><span>{route._id}</span><strong>{route.count}</strong></div>
            )) : <p className="empty-state">No route trends yet.</p>}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header"><h3>User registrations</h3></div>
          <div className="mini-list">
            {analytics.userRegistrations?.length ? analytics.userRegistrations.map((entry) => (
              <div key={entry._id} className="mini-list-row"><span>{entry._id}</span><strong>{entry.count}</strong></div>
            )) : <p className="empty-state">No registration analytics yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
