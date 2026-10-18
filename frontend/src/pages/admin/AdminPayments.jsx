import { useEffect, useState } from 'react';
import api from '../../services/api';

const formatCurrency = (value = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const load = async () => {
      const response = await api.get('/admin/payments');
      setPayments(response.data.payments || []);
    };

    load();
  }, []);

  const summary = {
    totalRevenue: payments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    successfulPayments: payments.filter((item) => (item.status || '').toLowerCase() === 'success').length,
    pendingPayments: payments.filter((item) => (item.status || '').toLowerCase() === 'pending').length,
    failedPayments: payments.filter((item) => (item.status || '').toLowerCase() === 'failed').length,
  };

  return (
    <div className="admin-page-block">
      <div className="admin-summary-grid compact-grid">
        <div className="admin-stat-card admin-stat-card--violet"><div className="admin-stat-icon">₹</div><div><span className="admin-stat-label">Total Revenue</span><h3>{formatCurrency(summary.totalRevenue)}</h3></div></div>
        <div className="admin-stat-card admin-stat-card--emerald"><div className="admin-stat-icon">✓</div><div><span className="admin-stat-label">Successful Payments</span><h3>{summary.successfulPayments}</h3></div></div>
        <div className="admin-stat-card admin-stat-card--amber"><div className="admin-stat-icon">⏳</div><div><span className="admin-stat-label">Pending Payments</span><h3>{summary.pendingPayments}</h3></div></div>
        <div className="admin-stat-card admin-stat-card--danger"><div className="admin-stat-icon">✕</div><div><span className="admin-stat-label">Failed Payments</span><h3>{summary.failedPayments}</h3></div></div>
      </div>

      <div className="admin-panel">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Booking ID</th>
              <th>User</th>
              <th>Amount</th>
              <th>Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.length ? payments.map((payment) => (
              <tr key={payment._id}>
                <td>{payment.transactionId || '-'}</td>
                <td>{payment.booking?._id || '-'}</td>
                <td>{payment.user?.name || 'User'}</td>
                <td>{formatCurrency(payment.amount || 0)}</td>
                <td>{payment.paymentMode || 'UPI'}</td>
                <td><span className="status-pill success">{payment.status || 'PENDING'}</span></td>
              </tr>
            )) : <tr><td colSpan="6" className="empty-cell">No payments yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPayments;
