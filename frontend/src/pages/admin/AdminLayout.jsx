import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ArrowRightLeft,
  BarChart3,
  Bell,
  BriefcaseBusiness,
  BusFront,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  ClipboardList,
  Users,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Managers', path: '/admin/managers', icon: ShieldCheck },
  { label: 'Buses', path: '/admin/buses', icon: BusFront },
  { label: 'Bookings', path: '/admin/bookings', icon: BriefcaseBusiness },
  { label: 'Users', path: '/admin/users', icon: Users },
  { label: 'Payments', path: '/admin/payments', icon: CreditCard },
  { label: 'Emergency', path: '/admin/emergency', icon: ShieldAlert },
  { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { label: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList },
  { label: 'Notifications', path: '/admin/notifications', icon: Bell },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

const AdminLayout = () => {
  const navigate = useNavigate();
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

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
            <div className="admin-sidebar-label">BusBook</div>
            <h2>Admin</h2>
          </div>
        </div>

        <nav className="admin-nav">
          {navItems.map(({ label, path, icon: Icon }) => (
            <NavLink key={path} to={path} className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={17} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-profile-badge">
            <span>{(currentUser.name || 'A').charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <strong>{currentUser.name || 'Admin'}</strong>
            <small>{currentUser.email || 'admin@busbook.com'}</small>
          </div>
          <button type="button" className="admin-logout-btn" onClick={handleLogout}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="admin-main-panel">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">Overview</p>
            <h1>Admin Dashboard</h1>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-search-box">
              <Search size={16} />
              <input type="text" placeholder="Search" aria-label="Search" />
            </div>
            <button type="button" className="admin-icon-button" aria-label="Notifications">
              <Bell size={16} />
            </button>
            <div className="admin-user-pill">
              <div className="admin-user-avatar">A</div>
              <div>
                <strong>{currentUser.name || 'Admin'}</strong>
                <small>Admin</small>
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

export default AdminLayout;
