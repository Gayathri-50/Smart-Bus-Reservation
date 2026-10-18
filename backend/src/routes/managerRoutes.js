const express = require('express');
const {
  getManagerDashboard,
  getManagerUsers,
  getManagerBookings,
  getManagerNotifications,
} = require('../controllers/managerController');
const { authenticateUser, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);
router.use(requireRole('MANAGER', 'ADMIN'));

router.get('/dashboard', getManagerDashboard);
router.get('/users', getManagerUsers);
router.get('/bookings', getManagerBookings);
router.get('/notifications', getManagerNotifications);

module.exports = router;
