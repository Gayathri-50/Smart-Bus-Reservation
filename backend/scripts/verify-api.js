/**
 * HTTP API Verification Script
 * Starts backend on test port and validates real HTTP requests,
 * authentication, role boundaries (Admin vs 3 Managers), and endpoints.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const http = require('http');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const connectDB = require('../src/config/db');

const TEST_PORT = 3005;
const BASE_URL = `http://localhost:${TEST_PORT}`;

async function runApiTests() {
  console.log('🚀 Starting API Endpoints & Role Authorization Test...');
  await connectDB();

  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', require('../src/routes/authRoutes'));
  app.use('/api/admin', require('../src/routes/adminRoutes'));
  app.use('/api/buses', require('../src/routes/busRoutes'));
  app.use('/api/bookings', require('../src/routes/bookingRoutes'));
  app.use('/api/emergency', require('../src/routes/emergencyRoutes'));
  app.use('/api/payments', require('../src/routes/paymentRoutes'));
  app.use('/api/connections', require('../src/routes/connectionRoutes'));
  app.use('/api/boarding', require('../src/routes/boardingRoutes'));
  app.use('/api/manager', require('../src/routes/managerRoutes'));

  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'Bus Booking Backend' }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test API server listening on ${BASE_URL}`);

  let passed = 0;
  let total = 0;

  const test = async (name, fn) => {
    total++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.response?.data?.message || err.message}`);
    }
  };

  try {
    // 1. Health check
    await test('GET /api/health Endpoint', async () => {
      const res = await axios.get(`${BASE_URL}/api/health`);
      if (res.status !== 200 || res.data?.status !== 'ok') throw new Error('Health check failed');
    });

    // 2. Super Admin Login
    let adminToken = '';
    await test('Super Admin Authentication (POST /api/auth/login)', async () => {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'admin@busbook.com',
        password: 'Admin@12345',
      });
      if (!res.data?.token || res.data?.user?.role !== 'ADMIN') {
        throw new Error(`Admin login failed: ${JSON.stringify(res.data)}`);
      }
      adminToken = res.data.token;
    });

    // 3. Bus Operations Manager Login
    let busOpsToken = '';
    await test('Bus Operations Manager Authentication', async () => {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'bus.ops@busbook.com',
        password: 'Password@123',
      });
      if (!res.data?.token || res.data?.user?.role !== 'bus_manager') {
        throw new Error(`Bus manager login failed: ${JSON.stringify(res.data)}`);
      }
      busOpsToken = res.data.token;
    });

    // 4. Booking Manager Login
    let bookingToken = '';
    await test('Booking Manager Authentication', async () => {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'bookings@busbook.com',
        password: 'Password@123',
      });
      if (!res.data?.token || res.data?.user?.role !== 'booking_manager') {
        throw new Error(`Booking manager login failed: ${JSON.stringify(res.data)}`);
      }
      bookingToken = res.data.token;
    });

    // 5. Finance Manager Login
    let financeToken = '';
    await test('Finance Manager Authentication', async () => {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, {
        email: 'finance@busbook.com',
        password: 'Password@123',
      });
      if (!res.data?.token || res.data?.user?.role !== 'finance_manager') {
        throw new Error(`Finance manager login failed: ${JSON.stringify(res.data)}`);
      }
      financeToken = res.data.token;
    });

    // 6. Role Boundaries: Bus Operations Manager
    await test('Bus Ops Permissions: Allowed on Fleet, Forbidden on Finance', async () => {
      // Allowed on buses
      const busesRes = await axios.get(`${BASE_URL}/api/admin/buses`, {
        headers: { Authorization: `Bearer ${busOpsToken}` },
      });
      if (busesRes.status !== 200) throw new Error('Bus ops cannot view buses');

      // Forbidden on payments
      let paymentBlocked = false;
      try {
        await axios.get(`${BASE_URL}/api/admin/payments`, {
          headers: { Authorization: `Bearer ${busOpsToken}` },
        });
      } catch (err) {
        if (err.response?.status === 403) paymentBlocked = true;
      }
      if (!paymentBlocked) throw new Error('Security Breach: Bus Ops was able to access finance payments');
    });

    // 7. Role Boundaries: Booking Manager
    await test('Booking Mgr Permissions: Allowed on Bookings, Forbidden on Staff Management', async () => {
      // Allowed on bookings
      const bookingsRes = await axios.get(`${BASE_URL}/api/admin/bookings`, {
        headers: { Authorization: `Bearer ${bookingToken}` },
      });
      if (bookingsRes.status !== 200) throw new Error('Booking mgr cannot view bookings');

      // Forbidden on managers
      let managersBlocked = false;
      try {
        await axios.get(`${BASE_URL}/api/admin/managers`, {
          headers: { Authorization: `Bearer ${bookingToken}` },
        });
      } catch (err) {
        if (err.response?.status === 403) managersBlocked = true;
      }
      if (!managersBlocked) throw new Error('Security Breach: Booking Mgr was able to access manager management');
    });

    // 8. Role Boundaries: Finance Manager
    await test('Finance Mgr Permissions: Allowed on Payments, Forbidden on Fleet Modification', async () => {
      // Allowed on payments
      const paymentsRes = await axios.get(`${BASE_URL}/api/admin/payments`, {
        headers: { Authorization: `Bearer ${financeToken}` },
      });
      if (paymentsRes.status !== 200) throw new Error('Finance mgr cannot view payments');

      // Forbidden on bus creation/modification
      let busCreateBlocked = false;
      try {
        await axios.post(
          `${BASE_URL}/api/admin/buses`,
          { busName: 'Unauthorized Bus' },
          { headers: { Authorization: `Bearer ${financeToken}` } }
        );
      } catch (err) {
        if (err.response?.status === 403) busCreateBlocked = true;
      }
      if (!busCreateBlocked) throw new Error('Security Breach: Finance Mgr was able to create buses');
    });

    // 9. Super Admin: Platform Settings & Audit
    await test('Super Admin: Settings & Notification Audit Logs Access', async () => {
      const settingsRes = await axios.get(`${BASE_URL}/api/admin/settings`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (settingsRes.status !== 200 || !settingsRes.data?.settings) throw new Error('Failed to fetch settings');

      const notifsRes = await axios.get(`${BASE_URL}/api/admin/notifications`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (notifsRes.status !== 200 || !Array.isArray(notifsRes.data?.notifications)) throw new Error('Failed to fetch notifications');
    });

    // 10. Password Reset API validation
    await test('Forgot Password & Invalid Reset Token Handled Properly', async () => {
      const forgotRes = await axios.post(`${BASE_URL}/api/auth/forgot-password`, {
        email: 'test.user@notexist.com',
      });
      if (forgotRes.status !== 200) throw new Error('Forgot password failed');

      let resetRejected = false;
      try {
        await axios.post(`${BASE_URL}/api/auth/reset-password`, {
          token: 'invalid_expired_token_123',
          newPassword: 'NewPassword@123',
        });
      } catch (err) {
        if (err.response?.status === 400) resetRejected = true;
      }
      if (!resetRejected) throw new Error('Invalid reset token was unexpectedly accepted');
    });

  } finally {
    server.close();
  }

  console.log(`\n==============================================`);
  console.log(`  API Tests Completed: ${passed}/${total} Passed`);
  console.log(`==============================================\n`);

  process.exit(passed === total ? 0 : 1);
}

runApiTests().catch((err) => {
  console.error('Fatal API Test Error:', err);
  process.exit(1);
});
