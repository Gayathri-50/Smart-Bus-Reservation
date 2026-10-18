import { useState, useEffect } from 'react';
import { Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import api from '../../services/api';

const AdminSettings = () => {
  const [settings, setSettings] = useState({
    bookingApproval: true,
    autoCancellation: true,
    emergencySeatHold: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const fetchSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await api.get('/admin/settings');
      if (res.data?.settings) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
      setMessage({ type: 'error', text: 'Failed to load platform settings.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await api.put('/admin/settings', settings);
      setMessage({
        type: 'success',
        text: res.data?.message || 'Platform settings updated and persisted successfully.',
      });
    } catch (err) {
      console.error('Failed to save settings', err);
      setMessage({
        type: 'error',
        text: err.response?.data?.message || 'Failed to update platform settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page-block">
      <div className="admin-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Platform & Operational Settings</h3>
          <p className="text-xs text-slate-400">Configure core reservation policies, hold limits, and dispatch settings.</p>
        </div>
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={fetchSettings}
          disabled={loading || saving}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {message && (
        <div
          style={{
            margin: '16px 0',
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: message.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '14px',
          }}
        >
          {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="admin-panel settings-panel">
        <div className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
          <div>
            <strong className="block text-slate-200">Manual Booking Approval</strong>
            <small className="text-slate-400">Require Booking Manager review before confirming priority reservations</small>
          </div>
          <button
            type="button"
            className={`toggle-btn ${settings.bookingApproval ? 'active' : ''}`}
            onClick={() => handleToggle('bookingApproval')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              background: settings.bookingApproval ? '#4f46e5' : '#334155',
              color: '#ffffff',
              border: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {settings.bookingApproval ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
          <div>
            <strong className="block text-slate-200">Auto Reservation Cancellation</strong>
            <small className="text-slate-400">Release pending seats and expire unpaid bookings automatically after 15 minutes</small>
          </div>
          <button
            type="button"
            className={`toggle-btn ${settings.autoCancellation ? 'active' : ''}`}
            onClick={() => handleToggle('autoCancellation')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              background: settings.autoCancellation ? '#4f46e5' : '#334155',
              color: '#ffffff',
              border: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {settings.autoCancellation ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div className="settings-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
          <div>
            <strong className="block text-slate-200">Emergency Seat Quota Hold</strong>
            <small className="text-slate-400">Reserve seats 39 and 40 exclusively for Emergency / Priority reservation requests</small>
          </div>
          <button
            type="button"
            className={`toggle-btn ${settings.emergencySeatHold ? 'active' : ''}`}
            onClick={() => handleToggle('emergencySeatHold')}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              background: settings.emergencySeatHold ? '#4f46e5' : '#334155',
              color: '#ffffff',
              border: 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {settings.emergencySeatHold ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              background: '#4f46e5',
              color: '#ffffff',
              borderRadius: '8px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Save size={16} /> {saving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
