import { Navigate, useLocation } from 'react-router-dom';

const AdminRoute = ({ children, allowedRoles = ['ADMIN', 'admin'] }) => {
  const token = localStorage.getItem('authToken');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user.isActive === false) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('authChange'));
    return <Navigate to="/login" replace />;
  }

  const role = String(user.role || '').toUpperCase();
  const normalizedAllowed = allowedRoles.map((r) => String(r).toUpperCase());

  // ADMIN is universally permitted across staff routes
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    return children;
  }

  if (!normalizedAllowed.includes(role)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
};

export default AdminRoute;
