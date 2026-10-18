import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import api from '../../services/api';

const formatCurrency = (val = 0) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

const ManagerFinance = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [exporting, setExporting] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/payments');
      setPayments(res.data.payments || []);
    } catch (err) {
      console.error('Failed to load payments ledger', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const token = localStorage.getItem('authToken');
      const response = await fetch('http://localhost:3000/api/admin/payments/export', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to download CSV');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BusBook_Financial_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Error downloading CSV report: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const filteredPayments = payments.filter((p) => {
    const sMatch =
      statusFilter === 'all' || (p.status || '').toLowerCase() === statusFilter.toLowerCase();
    const mMatch =
      methodFilter === 'all' || (p.paymentMode || '').toLowerCase() === methodFilter.toLowerCase();
    return sMatch && mMatch;
  });

  const totalRevenue = payments
    .filter((p) => (p.status || '').toLowerCase() === 'success')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const successfulTxns = payments.filter((p) => (p.status || '').toLowerCase() === 'success').length;
  const pendingTxns = payments.filter((p) => (p.status || '').toLowerCase() === 'pending').length;
  const failedTxns = payments.filter((p) => (p.status || '').toLowerCase() === 'failed').length;

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header admin-panel-header-inline">
        <div>
          <h3>Finance & Payment Ledger</h3>
          <p className="text-sm text-slate-400">
            Track transactions, verify payment statuses, reconcile revenue, and export financial spreadsheets.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="admin-action-btn flex items-center gap-2"
            onClick={fetchPayments}
          >
            <RefreshCw size={15} />
            Refresh
          </button>
          <button
            type="button"
            className="admin-action-btn primary flex items-center gap-2"
            onClick={handleExportCSV}
            disabled={exporting}
          >
            <Download size={15} />
            {exporting ? 'Exporting...' : 'Export Financial CSV'}
          </button>
        </div>
      </div>

      <div className="admin-summary-grid compact-grid mb-6">
        <div className="admin-stat-card admin-stat-card--violet">
          <div className="admin-stat-icon">₹</div>
          <div>
            <span className="admin-stat-label">Net Confirmed Revenue</span>
            <h3>{formatCurrency(totalRevenue)}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--emerald">
          <div className="admin-stat-icon">✓</div>
          <div>
            <span className="admin-stat-label">Success Transactions</span>
            <h3>{successfulTxns}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--amber">
          <div className="admin-stat-icon">⏳</div>
          <div>
            <span className="admin-stat-label">Pending Settlements</span>
            <h3>{pendingTxns}</h3>
          </div>
        </div>
        <div className="admin-stat-card admin-stat-card--danger">
          <div className="admin-stat-icon">✕</div>
          <div>
            <span className="admin-stat-label">Failed / Declined</span>
            <h3>{failedTxns}</h3>
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter status"
        >
          <option value="all">All Statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          aria-label="Filter method"
        >
          <option value="all">All Payment Modes</option>
          <option value="upi">UPI</option>
          <option value="card">Cards</option>
          <option value="netbanking">Net Banking</option>
          <option value="wallet">Wallet</option>
        </select>
      </div>

      <div className="admin-panel">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading ledger records...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Booking Ref</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Mode</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length ? (
                filteredPayments.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <span className="font-mono text-xs text-indigo-300">
                        {p.transactionId || p._id}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-400">
                        {p.booking?._id ? `#${p.booking._id.slice(-8).toUpperCase()}` : '-'}
                      </span>
                    </td>
                    <td>
                      <strong className="block text-slate-200">{p.user?.name || 'Customer'}</strong>
                      <span className="text-xs text-slate-400">{p.user?.email || '-'}</span>
                    </td>
                    <td>
                      <strong className="text-slate-100 font-semibold">
                        {formatCurrency(p.amount || 0)}
                      </strong>
                    </td>
                    <td>
                      <span className="text-xs uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        {p.paymentMode || 'UPI'}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-400 font-mono">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '-'}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          (p.status || '').toLowerCase() === 'success'
                            ? 'success'
                            : (p.status || '').toLowerCase() === 'failed'
                            ? 'danger'
                            : 'warning'
                        }`}
                      >
                        {p.status || 'PENDING'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-cell text-center p-8 text-slate-400">
                    No transactions matching the selected filters.
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

export default ManagerFinance;
