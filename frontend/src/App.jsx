import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ChatbotWidget from './components/ChatbotWidget';
import Footer from './components/Footer';
import Home from './pages/Home';
import SearchBus from './pages/SearchBus';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import BusDetails from './pages/BusDetails';
import SeatSelection from './pages/SeatSelection';
import Payment from './pages/Payment';
import BookingConfirmation from './pages/BookingConfirmation';
import BookingHistory from './pages/BookingHistory';
import ForgotPassword from './pages/ForgotPassword';
import EmergencyReservation from './pages/EmergencyReservation';

// Admin components
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminManagers from './pages/admin/AdminManagers';
import AdminBuses from './pages/admin/AdminBuses';
import AdminBookings from './pages/admin/AdminBookings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPayments from './pages/admin/AdminPayments';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminEmergency from './pages/admin/AdminEmergency';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAuditLogs from './pages/admin/AdminAuditLogs';
import AdminNotifications from './pages/admin/AdminNotifications';
import AccessDenied from './pages/admin/AccessDenied';
import AdminRoute from './pages/admin/AdminRoute';

// Manager components
import ManagerLayout from './pages/manager/ManagerLayout';
import ManagerBuses from './pages/manager/ManagerBuses';
import ManagerBookings from './pages/manager/ManagerBookings';
import ManagerEmergency from './pages/manager/ManagerEmergency';
import ManagerFinance from './pages/manager/ManagerFinance';
import ManagerAnalytics from './pages/manager/ManagerAnalytics';

// Manager index redirect based on role
const ManagerIndexRedirect = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const role = String(user.role || '').toLowerCase();
  if (role.includes('booking')) {
    return <Navigate to="bookings" replace />;
  }
  if (role.includes('finance')) {
    return <Navigate to="finance" replace />;
  }
  return <Navigate to="buses" replace />;
};

function App() {
  const location = useLocation();
  const hideAuthShell =
    ['/login', '/register', '/forgot-password', '/access-denied'].includes(location.pathname) ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/manager');

  return (
    <div className="app-shell min-h-screen bg-slate-950 text-slate-100">
      {!hideAuthShell && <Navbar />}
      <main className={hideAuthShell ? '' : 'pb-24'}>
        <Routes>
          {/* Public & Customer Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/search-bus" element={<SearchBus />} />
          <Route path="/emergency-reservation" element={<EmergencyReservation />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/bus-details/:busId" element={<BusDetails />} />
          <Route path="/seat-selection/:busId" element={<SeatSelection />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/booking-confirmation" element={<BookingConfirmation />} />
          <Route path="/booking-history" element={<BookingHistory />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Super Admin Protected Routes */}
          <Route
            path="/admin"
            element={
              <AdminRoute allowedRoles={['admin']}>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="managers" element={<AdminManagers />} />
            <Route path="buses" element={<AdminBuses />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="emergency" element={<AdminEmergency />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Manager Protected Routes */}
          <Route
            path="/manager"
            element={
              <AdminRoute
                allowedRoles={['admin', 'bus_manager', 'booking_manager', 'finance_manager']}
              >
                <ManagerLayout />
              </AdminRoute>
            }
          >
            <Route index element={<ManagerIndexRedirect />} />
            <Route
              path="buses"
              element={
                <AdminRoute allowedRoles={['admin', 'bus_manager']}>
                  <ManagerBuses />
                </AdminRoute>
              }
            />
            <Route
              path="bookings"
              element={
                <AdminRoute allowedRoles={['admin', 'booking_manager']}>
                  <ManagerBookings />
                </AdminRoute>
              }
            />
            <Route
              path="emergency"
              element={
                <AdminRoute allowedRoles={['admin', 'booking_manager']}>
                  <ManagerEmergency />
                </AdminRoute>
              }
            />
            <Route
              path="finance"
              element={
                <AdminRoute allowedRoles={['admin', 'finance_manager']}>
                  <ManagerFinance />
                </AdminRoute>
              }
            />
            <Route
              path="finance/analytics"
              element={
                <AdminRoute allowedRoles={['admin', 'finance_manager']}>
                  <ManagerAnalytics />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {!hideAuthShell && <Footer />}
      {!hideAuthShell && <ChatbotWidget />}
    </div>
  );
}

export default App;
