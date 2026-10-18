import { useEffect, useState } from 'react';
import { ClipboardList, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react';
import api from '../../services/api';

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/audit-logs');
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filterAction === 'all') return true;
    return (log.action || '').toLowerCase().includes(filterAction.toLowerCase());
  });

  const getActionBadge = (action) => {
    if (action.includes('CREATE')) return 'status-pill success';
    if (action.includes('DELETE') || action.includes('DEACTIVATE')) return 'status-pill danger';
    if (action.includes('UPDATE') || action.includes('ACTIVATE')) return 'status-pill warning';
    return 'status-pill info';
  };

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header admin-panel-header-inline">
        <div>
          <h3>System Audit Logs</h3>
          <p className="text-sm text-slate-400">
            Immutable log of high-privilege operations, manager modifications, and administrative tasks.
          </p>
        </div>
        <button
          type="button"
          className="admin-action-btn flex items-center gap-2"
          onClick={fetchLogs}
        >
          <RefreshCw size={15} />
          Refresh Logs
        </button>
      </div>

      <div className="admin-toolbar">
        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          aria-label="Filter action"
        >
          <option value="all">All Actions</option>
          <option value="MANAGER">Manager Actions</option>
          <option value="BUS">Bus Fleet Actions</option>
          <option value="BOOKING">Booking Actions</option>
          <option value="STATUS">Status Toggles</option>
        </select>
      </div>

      <div className="admin-panel">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Loading audit records...</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Operator</th>
                <th>Action</th>
                <th>Target</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length ? (
                filteredLogs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      <span className="text-xs text-slate-300 font-mono">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : '-'}
                      </span>
                    </td>
                    <td>
                      <div>
                        <strong className="text-slate-200 block text-sm">
                          {log.performedBy?.name || 'Staff User'}
                        </strong>
                        <span className="text-xs text-slate-400">
                          {log.performedBy?.role || 'admin'} • {log.performedBy?.email || ''}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={getActionBadge(log.action)}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-300 font-medium">
                        {log.targetType || 'SYSTEM'}
                      </span>
                    </td>
                    <td>
                      <pre className="text-xs text-slate-400 bg-slate-950/60 p-2 rounded max-w-md overflow-x-auto font-mono">
                        {JSON.stringify(log.details || {}, null, 2)}
                      </pre>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-cell text-center p-8 text-slate-400">
                    No audit records found.
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

export default AdminAuditLogs;
