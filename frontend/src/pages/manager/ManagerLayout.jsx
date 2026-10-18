import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BriefcaseBusiness,
  BusFront,
  CreditCard,
  FileSpreadsheet,
  LogOut,
  ShieldAlert,
} from 'lucide-react';

const roleMeta = {
  admin: {
    title: 'Super Admin Portal',
    navItems: [
      { label: 'Bus Fleet', path: '/manager/buses', icon: BusFront },
      { label: 'Bookings', path: '/manager/bookings', icon: BriefcaseBusiness },
      { label: 'Emergency', path: '/manager/emergency', icon: ShieldAlert },
      { label: 'Finance & Payments', path: '/manager/finance', icon: CreditCard },
      { label: 'Revenue Analytics', path: '/manager/finance/analytics', icon: BarChart3 },
    ],
  },
  bus_manager: {
    title: 'Bus Operations Manager',
    navItems: [
      { label: 'Fleet Management', path: '/manager/buses', icon: BusFront },
    ],
  },
  booking_manager: {
    title: 'Booking Manager',
    navItems: [
      { label: 'Reservations & Tickets', path: '/manager/bookings', icon: BriefcaseBusiness },
      { label: 'Emergency Bookings', path: '/manager/emergency', icon: ShieldAlert },
    ],
  },
  finance_manager: {
    title: 'Finance Manager',
    navItems: [
      { label: 'Transactions & Ledger', path: '/manager/finance', icon: CreditCard },
      { label: 'Revenue Analytics', path: '/manager/finance/analytics', icon: BarChart3 },
    ],
  },
};

const ManagerLayout = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const rawRole = String(currentUser.role || 'bus_manager').toLowerCase();
  const normalizedRole = rawRole === 'manager' ? 'bus_manager' : rawRole;
  const roleConfig = roleMeta[normalizedRole] || roleMeta[rawRole] || roleMeta.bus_manager;

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('authChange'));
    navigate('/login');
  };

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo-pill">
            <BusFront size={18} />
          </div>
          <div>
            <div className="admin-sidebar-label">BusBook Staff</div>
            <h2 className="text-sm font-semibold truncate max-w-[160px]">{roleConfig.title}</h2>
          </div>
        </div>

        <nav className="admin-nav">
          {roleConfig.navItems.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-badge">
            <span>{(currentUser.name || 'M').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <strong>{currentUser.name || 'Manager'}</strong>
            <small className="block truncate max-w-[120px]">{currentUser.email}</small>
          </div>
          <button
            type="button"
            className="admin-logout-btn"
            title="Log out"
            onClick={handleLogout}
          >
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="admin-main-panel">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Staff Portal</p>
            <h1>{roleConfig.title}</h1>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-user-pill">
              <div className="admin-user-avatar">
                {(currentUser.name || 'M').charAt(0).toUpperCase()}
              </div>
              <div>
                <strong>{currentUser.name || 'Staff User'}</strong>
                <small className="capitalize">{(currentUser.role || 'manager').replace('_', ' ')}</small>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;
