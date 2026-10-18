import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

const AccessDenied = () => {
  return (
    <div className="access-denied-page">
      <div className="access-denied-card">
        <div className="access-denied-icon"><ShieldAlert size={32} /></div>
        <p className="admin-kicker">Restricted access</p>
        <h1>Access Denied</h1>
        <p>You do not have permission to view the admin dashboard.</p>
        <Link to="/" className="primary-btn">Return to Home</Link>
      </div>
    </div>
  );
};

export default AccessDenied;
