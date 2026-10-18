import { useState, useEffect } from 'react';
import {
  Mail,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import api from '../../services/api';

const AdminNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterChannel, setFilterChannel] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Retrying state
  const [retryingId, setRetryingId] = useState(null);
  const [actionAlert, setActionAlert] = useState(null);

  // SMTP Gateway status & test state
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [checkingSmtp, setCheckingSmtp] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/notifications');
      setNotifications(res.data?.notifications || []);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const checkSmtpConnection = async () => {
    setCheckingSmtp(true);
    try {
      const res = await api.get('/admin/email/verify');
      setSmtpStatus(res.data);
    } catch (err) {
      setSmtpStatus({
        configured: false,
        verified: false,
        error: err.response?.data?.error || err.message || 'Connection check failed',
      });
    } finally {
      setCheckingSmtp(false);
    }
  };

  const handleSendTestEmail = async (e) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes('@')) {
      setTestResult({ success: false, message: 'Please enter a valid recipient email address' });
      return;
    }

    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await api.post('/admin/email/test', { email: testEmail });
      setTestResult({
        success: true,
        message: res.data?.message || `Test email dispatched successfully to ${testEmail}!`,
        messageId: res.data?.messageId,
      });
      // Refresh logs so the admin can see the test email recorded if applicable
      fetchNotifications();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to dispatch test email';
      setTestResult({
        success: false,
        message: errMsg,
      });
    } finally {
      setSendingTest(false);
    }
  };

  const handleRetry = async (notificationId) => {
    setRetryingId(notificationId);
    setActionAlert(null);
    try {
      const res = await api.post(`/admin/notifications/${notificationId}/retry`);
      if (res.data?.success) {
        setActionAlert({
          type: 'success',
          text: `Notification #${notificationId.slice(-6).toUpperCase()} resent successfully!`,
        });
      } else {
        setActionAlert({
          type: 'error',
          text: `Retry failed: ${res.data?.message || 'Provider rejected delivery'}`,
        });
      }
      // Reload notifications to update status and attempt count
      await fetchNotifications();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.response?.data?.error || err.message;
      setActionAlert({
        type: 'error',
        text: `Retry request failed: ${errMsg}`,
      });
    } finally {
      setRetryingId(null);
    }
  };

  useEffect(() => {
    fetchNotifications();
    checkSmtpConnection();
  }, []);

  const filtered = notifications.filter((item) => {
    if (filterChannel !== 'ALL' && item.channel !== filterChannel) return false;
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const recipient = (item.recipient?.name || '').toLowerCase();
      const email = (item.recipient?.email || '').toLowerCase();
      const phone = (item.recipient?.phone || '').toLowerCase();
      const type = (item.type || '').toLowerCase();
      return recipient.includes(term) || email.includes(term) || phone.includes(term) || type.includes(term);
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'DELIVERED':
      case 'ACCEPTED':
      case 'SENT':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontSize: '12px', fontWeight: 600 }}>
            <CheckCircle2 size={13} /> {status}
          </span>
        );
      case 'FAILED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '12px', fontWeight: 600 }}>
            <AlertCircle size={13} /> FAILED
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontSize: '12px', fontWeight: 600 }}>
            <Clock size={13} /> {status || 'PENDING'}
          </span>
        );
    }
  };

  const maskContact = (text) => {
    if (!text) return '-';
    if (text.includes('@')) {
      const [name, domain] = text.split('@');
      return `${name.slice(0, 2)}***@${domain}`;
    }
    if (text.length >= 7) {
      return `${text.slice(0, 3)}****${text.slice(-3)}`;
    }
    return text;
  };

  return (
    <div className="admin-page-block">
      {/* Header */}
      <div className="admin-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3>Safety &amp; Operational Notification Logs</h3>
          <p className="text-xs text-slate-400">Real-time audit trail of customer booking confirmations, guardian safety alerts, reminders, and retry dispatches.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={checkSmtpConnection}
            disabled={checkingSmtp}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={14} className={checkingSmtp ? 'animate-spin' : ''} /> Check SMTP Status
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={fetchNotifications}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          style={{
            margin: '14px 0',
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: actionAlert.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${actionAlert.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: actionAlert.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actionAlert.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{actionAlert.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionAlert(null)}
            style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* SMTP Gateway Diagnostics & Isolated Test Panel */}
      <div
        className="admin-panel"
        style={{
          margin: '16px 0',
          padding: '18px 20px',
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: '10px',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {/* Left: Connection Status */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail size={15} color="#38bdf8" /> Nodemailer SMTP Server Gateway
              </span>
              {smtpStatus?.verified ? (
                <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontSize: '11px', fontWeight: 700 }}>
                  ACTIVE &amp; VERIFIED
                </span>
              ) : (
                <span style={{ padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', fontSize: '11px', fontWeight: 700 }}>
                  {smtpStatus?.configured ? 'AUTH FAILED' : 'NOT CONFIGURED'}
                </span>
              )}
            </div>

            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 10px 0' }}>
              {smtpStatus?.verified
                ? `Connected to ${smtpStatus?.host || 'SMTP'} on port ${smtpStatus?.port || 587}. Outgoing user: ${smtpStatus?.user || 'Configured'}.`
                : smtpStatus?.error
                ? `Error: ${smtpStatus.error}`
                : 'SMTP credentials missing. Please set SMTP_USER and SMTP_PASSWORD in backend/.env.'}
            </p>

            <button
              type="button"
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                border: 'none',
                color: '#818cf8',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 0',
                fontWeight: 500,
              }}
            >
              <HelpCircle size={14} />
              {showSetupGuide ? 'Hide Gmail Setup Instructions' : 'How to set up Gmail SMTP App Password'}
              {showSetupGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Right: Isolated Dev Test Email Tool */}
          <div>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '8px' }}>
              Send Diagnostic Test Email
            </span>
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 10px 0' }}>
              Dispatches an isolated test message without confirming bookings or modifying live customer data.
            </p>

            <form onSubmit={handleSendTestEmail} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="email"
                placeholder="Enter test recipient email..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                required
                style={{
                  flex: 1,
                  minWidth: '200px',
                  padding: '8px 12px',
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '13px',
                }}
              />
              <button
                type="submit"
                disabled={sendingTest}
                className="admin-btn admin-btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  fontSize: '13px',
                }}
              >
                <Send size={13} className={sendingTest ? 'animate-spin' : ''} />
                {sendingTest ? 'Sending...' : 'Send Test Email'}
              </button>
            </form>

            {testResult && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  border: `1px solid ${testResult.success ? '#10b981' : '#ef4444'}`,
                  color: testResult.success ? '#34d399' : '#f87171',
                }}
              >
                {testResult.message}
                {testResult.messageId && (
                  <span style={{ display: 'block', fontFamily: 'monospace', fontSize: '11px', marginTop: '2px', color: '#cbd5e1' }}>
                    Message-ID: {testResult.messageId}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Expandable Setup Instructions */}
        {showSetupGuide && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px 16px',
              background: '#090d16',
              borderRadius: '8px',
              border: '1px solid #334155',
              fontSize: '12px',
              color: '#cbd5e1',
              lineHeight: '1.6',
            }}
          >
            <strong style={{ color: '#f8fafc', display: 'block', marginBottom: '6px' }}>
              Google Gmail SMTP Configuration (3 Easy Steps):
            </strong>
            <ol style={{ paddingLeft: '20px', margin: 0 }}>
              <li>
                <strong>Enable 2-Step Verification:</strong> Go to your Google Account at{' '}
                <a
                  href="https://myaccount.google.com/security"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  myaccount.google.com/security
                </a>{' '}
                and verify that 2-Step Verification is turned <strong>ON</strong>.
              </li>
              <li>
                <strong>Generate a 16-Character App Password:</strong> Navigate to{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  myaccount.google.com/apppasswords
                </a>
                . Give your app a name (e.g. <code>BusBook</code>) and click <strong>Create</strong>. Copy the 16-letter password (e.g. <code>abcd efgh ijkl mnop</code>).
              </li>
              <li>
                <strong>Paste into <code>backend/.env</code>:</strong>
                <pre
                  style={{
                    background: '#1e293b',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    margin: '6px 0',
                    fontFamily: 'monospace',
                    color: '#34d399',
                  }}
                >
{`SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_char_app_password
EMAIL_FROM="BusBook Reservations" <your_email@gmail.com>`}
                </pre>
                Save the file, restart the backend server, and click <strong>Check SMTP Status</strong> above!
              </li>
            </ol>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: '12px', margin: '16px 0', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search by recipient, phone, or event..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '8px 12px 8px 36px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
          />
        </div>

        <select
          value={filterChannel}
          onChange={(e) => setFilterChannel(e.target.value)}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
        >
          <option value="ALL">All Delivery Channels</option>
          <option value="EMAIL">Email Gateway</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', fontSize: '13px' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="SENT">Sent / Accepted</option>
          <option value="FAILED">Failed / Unconfigured</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="admin-panel" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Event Type</th>
              <th>Channel</th>
              <th>Recipient</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Time</th>
              <th>Provider Info / Error</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading notification history...</td>
              </tr>
            ) : filtered.length ? (
              filtered.map((item) => (
                <tr key={item._id}>
                  <td>
                    <strong style={{ color: '#e2e8f0', fontSize: '13px' }}>
                      {(item.type || 'EVENT').replace(/_/g, ' ')}
                    </strong>
                    {item.booking && (
                      <span style={{ display: 'block', fontSize: '11px', color: '#818cf8', fontFamily: 'monospace' }}>
                        Ref #{String(item.booking._id || item.booking).slice(-6).toUpperCase()}
                      </span>
                    )}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#38bdf8' }}>
                      <Mail size={14} />
                      EMAIL
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '13px', color: '#e2e8f0' }}>{item.recipient?.name || 'Contact'}</div>
                    <small style={{ color: '#94a3b8' }}>{item.recipient?.relationship || 'Self'}</small>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#cbd5e1' }}>
                      {maskContact(item.channel === 'EMAIL' ? item.recipient?.email : item.recipient?.phone)}
                    </span>
                  </td>
                  <td>{getStatusBadge(item.status)}</td>
                  <td>
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                    {item.attemptCount > 1 && (
                      <span style={{ display: 'block', fontSize: '10px', color: '#fbbf24' }}>
                        Attempt #{item.attemptCount}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.error ? (
                      <span style={{ fontSize: '11px', color: '#f87171', display: 'block', maxWidth: '240px', wordBreak: 'break-word' }} title={item.error}>
                        {item.error}
                      </span>
                    ) : item.providerMessageId ? (
                      <span style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        ID: {item.providerMessageId.slice(0, 14)}...
                      </span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Provider confirmed</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.status === 'FAILED' ? (
                      <button
                        type="button"
                        onClick={() => handleRetry(item._id)}
                        disabled={retryingId === item._id}
                        title="Safely re-dispatch notification"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          background: '#4f46e5',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'background 0.2s ease',
                        }}
                      >
                        <RefreshCw size={11} className={retryingId === item._id ? 'animate-spin' : ''} />
                        {retryingId === item._id ? 'Retrying...' : 'Retry'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Delivered</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>No notification logs found matching criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminNotifications;
