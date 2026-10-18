const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateUser, requireAdmin, requireRole, getNormalizedRole } = require('../middleware/authMiddleware');
const User = require('../models/User');
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const ManagerConnection = require('../models/ManagerConnection');
const { formatDateString } = require('../services/tripService');

const router = express.Router();

// Helper to record administrative actions in the Audit Log
const logAuditAction = async (req, action, targetType, targetId, details = {}) => {
  try {
    await AuditLog.create({
      action,
      performedBy: {
        id: req.user?._id,
        name: req.user?.name || 'Staff User',
        email: req.user?.email || '',
        role: getNormalizedRole(req.user),
      },
      targetType,
      targetId: String(targetId || ''),
      details,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
};

// All /api/admin routes require an authenticated user with an active account
router.use(authenticateUser);

// =========================================================================
// SUPER ADMIN EXCLUSIVE ROUTES (requireAdmin)
// =========================================================================

// 1. Dashboard Overview
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const todayStr = formatDateString(new Date());

    const [
      totalManagers,
      totalUsers,
      totalBookings,
      todayBookings,
      emergencyBookings,
      totalBuses,
      totalTrips,
      boardedCount,
      failedNotifications,
      totalRevenue,
    ] = await Promise.all([
      User.countDocuments({ role: { $in: ['MANAGER', 'manager', 'bus_manager', 'booking_manager', 'finance_manager'] } }),
      User.countDocuments({ role: { $in: ['CUSTOMER', 'user'] } }),
      Booking.countDocuments(),
      Booking.countDocuments({ travelDate: todayStr }),
      Booking.countDocuments({ bookingType: { $in: ['EMERGENCY', 'emergency'] } }),
      Bus.countDocuments(),
      Trip.countDocuments(),
      Booking.countDocuments({ boardingStatus: 'BOARDED' }),
      Notification.countDocuments({ status: 'FAILED' }),
      Payment.aggregate([
        { $match: { status: { $in: ['SUCCESS', 'success'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: {
        totalManagers,
        totalUsers,
        totalBookings,
        todaysBookings: todayBookings,
        emergencyBookings,
        totalBuses,
        totalTrips,
        boardedCount,
        failedNotifications,
        totalRevenue: totalRevenue[0]?.total || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load dashboard stats', error: error.message });
  }
});

// 2. Manager Management
const MANAGER_ROLES = ['MANAGER', 'manager', 'bus_manager', 'booking_manager', 'finance_manager'];

// List all managers with their connected user count and bookings count
router.get('/managers', requireAdmin, async (req, res) => {
  try {
    const managers = await User.find({ role: { $in: MANAGER_ROLES } })
      .select('-password')
      .sort({ createdAt: -1 });

    const managersWithStats = await Promise.all(
      managers.map(async (m) => {
        const [connectedUsers, totalBookings] = await Promise.all([
          User.countDocuments({ manager: m._id }),
          Booking.countDocuments({ manager: m._id }),
        ]);

        return {
          ...m.toObject(),
          connectedUsers,
          totalBookings,
        };
      })
    );

    res.json({ success: true, managers: managersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch managers', error: error.message });
  }
});

// Create new manager account
router.post('/managers', requireAdmin, async (req, res) => {
  try {
    const { name, email, phone, role, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    // Auto-generate unique Manager ID code (e.g. MGR001)
    const count = await User.countDocuments({ role: { $in: MANAGER_ROLES } });
    const managerCode = `MGR${String(count + 1).padStart(3, '0')}`;

    const hashedPassword = await bcrypt.hash(password, 10);

    const manager = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: String(phone || '').trim(),
      role: role ? String(role).toUpperCase() : 'MANAGER',
      managerCode,
      password: hashedPassword,
      isActive: true,
    });

    await logAuditAction(req, 'CREATE_MANAGER', 'MANAGER', manager._id, {
      managerEmail: manager.email,
      managerRole: manager.role,
      managerCode,
    });

    const safeManager = manager.toObject();
    delete safeManager.password;

    res.status(201).json({ success: true, message: 'Manager created successfully', manager: safeManager });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create manager', error: error.message });
  }
});

// Update manager details
router.put('/managers/:id', requireAdmin, async (req, res) => {
  try {
    const { name, phone, role, password } = req.body;
    const manager = await User.findOne({ _id: req.params.id, role: { $in: MANAGER_ROLES } });

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    if (name) manager.name = String(name).trim();
    if (phone !== undefined) manager.phone = String(phone).trim();
    if (role) manager.role = String(role).toUpperCase();
    if (password && password.trim().length >= 6) {
      manager.password = await bcrypt.hash(password.trim(), 10);
    }

    await manager.save();

    await logAuditAction(req, 'UPDATE_MANAGER', 'MANAGER', manager._id, {
      updatedEmail: manager.email,
    });

    const safeManager = manager.toObject();
    delete safeManager.password;

    res.json({ success: true, message: 'Manager updated successfully', manager: safeManager });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update manager', error: error.message });
  }
});

// Toggle manager activation / suspension (Soft toggle)
router.patch('/managers/:id/status', requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const manager = await User.findOne({ _id: req.params.id, role: { $in: MANAGER_ROLES } });

    if (!manager) {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    manager.isActive = Boolean(isActive);
    await manager.save();

    await logAuditAction(req, isActive ? 'ACTIVATE_MANAGER' : 'SUSPEND_MANAGER', 'MANAGER', manager._id, {
      managerEmail: manager.email,
      isActive,
    });

    res.json({
      success: true,
      message: `Manager ${isActive ? 'activated' : 'suspended'} successfully`,
      manager,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to toggle status', error: error.message });
  }
});

// Soft-safe Delete / Deactivate manager
router.delete('/managers/:id', requireAdmin, async (req, res) => {
  try {
    const manager = await User.findOne({ _id: req.params.id, role: { $in: MANAGER_ROLES } });
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found' });

    // Check if manager has historical bookings or connected users
    const [bookingCount, userCount] = await Promise.all([
      Booking.countDocuments({ manager: manager._id }),
      User.countDocuments({ manager: manager._id }),
    ]);

    if (bookingCount > 0 || userCount > 0) {
      // PREVENT DELETION of historical records: Soft deactivation
      manager.isActive = false;
      await manager.save();
      await logAuditAction(req, 'DEACTIVATE_MANAGER', 'MANAGER', manager._id, {
        reason: 'Preserved historical bookings/connected users',
        bookingCount,
        userCount,
      });

      return res.json({
        success: true,
        message: 'Manager has historical booking/user records. Account deactivated to preserve audit data.',
      });
    }

    await User.findByIdAndDelete(manager._id);
    await logAuditAction(req, 'DELETE_MANAGER', 'MANAGER', manager._id, { deletedEmail: manager.email });

    res.json({ success: true, message: 'Manager account removed successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete manager', error: error.message });
  }
});

// Manager Drill-down (Admin clicks manager -> views users, bookings, trips, boarding, notifications)
router.get('/managers/:id/drilldown', requireAdmin, async (req, res) => {
  try {
    const manager = await User.findById(req.params.id).select('-password');
    if (!manager) return res.status(404).json({ success: false, message: 'Manager not found' });

    const [connectedUsers, bookings, boardingCount, requests] = await Promise.all([
      User.find({ manager: manager._id }).select('-password').sort({ createdAt: -1 }),
      Booking.find({ manager: manager._id }).populate('user', 'name email phone').sort({ createdAt: -1 }),
      Booking.countDocuments({ manager: manager._id, boardingStatus: 'BOARDED' }),
      ManagerConnection.find({ manager: manager._id }).populate('user', 'name email phone').sort({ createdAt: -1 }),
    ]);

    res.json({
      success: true,
      manager,
      connectedUsers,
      bookings,
      boardingCount,
      requests,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load manager drilldown', error: error.message });
  }
});

// 3. All Users (Admin overview with connected manager info)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password')
      .populate('manager', 'name email phone managerCode')
      .sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const bookingCount = await Booking.countDocuments({ user: u._id });
        return {
          ...u.toObject(),
          bookingCount,
        };
      })
    );

    res.json({ success: true, users: usersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// 4. Trips & Occupancy
router.get('/trips', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { travelDate, from, to } = req.query;
    const query = {};
    if (travelDate) query.travelDate = travelDate;
    if (from) query.from = new RegExp(from, 'i');
    if (to) query.to = new RegExp(to, 'i');

    const trips = await Trip.find(query).populate('bus').sort({ travelDate: 1, departureTime: 1 });
    res.json({ success: true, trips });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load trips', error: error.message });
  }
});

// 5. Emergency Tickets Breakdown (Available, Booked, Expired)
router.get('/emergency-tickets', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const todayStr = formatDateString(new Date());

    const emergencyBookings = await Booking.find({
      bookingType: { $in: ['EMERGENCY', 'emergency'] },
    })
      .populate('user', 'name email phone')
      .populate('manager', 'name email managerCode')
      .populate('bus')
      .sort({ createdAt: -1 });

    const categorized = {
      booked: emergencyBookings.filter((b) => b.travelDate >= todayStr && b.status !== 'CANCELLED'),
      expired: emergencyBookings.filter((b) => b.travelDate < todayStr || b.status === 'CANCELLED'),
    };

    res.json({ success: true, emergencyTickets: categorized, all: emergencyBookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load emergency tickets', error: error.message });
  }
});

// 6. Safety Notifications Log
router.get('/notifications', requireRole('ADMIN', 'BUS_MANAGER', 'BOOKING_MANAGER', 'FINANCE_MANAGER', 'MANAGER'), async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .populate('booking', 'from to travelDate departureTime seats passengerDetails safetyContact')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message });
  }
});

// Verify SMTP connection status
const emailService = require('../services/emailService');

router.get('/email/verify', requireAdmin, async (req, res) => {
  try {
    const result = await emailService.verifyTransporter();
    res.json(result);
  } catch (error) {
    res.status(500).json({ configured: false, verified: false, error: error.message });
  }
});

// Send isolated diagnostic test email
router.post('/email/test', requireAdmin, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Valid recipient email address is required' });
    }

    const result = await emailService.sendTestEmail(email.trim());
    if (result.success) {
      res.json({
        success: true,
        message: `Test email successfully dispatched to ${email}`,
        messageId: result.messageId,
      });
    } else {
      res.status(502).json({
        success: false,
        message: `Failed to deliver test email: ${result.error}`,
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send test email', error: error.message });
  }
});

// Safe retry for failed notification
router.post('/notifications/:id/retry', requireRole('ADMIN', 'BUS_MANAGER', 'BOOKING_MANAGER', 'MANAGER'), async (req, res) => {
  try {
    const notif = await Notification.findById(req.params.id);
    if (!notif) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notif.attemptCount = (notif.attemptCount || 1) + 1;

    if (notif.channel === 'EMAIL') {
      const recipientEmail = notif.recipient?.email;
      if (!recipientEmail) {
        return res.status(400).json({ success: false, message: 'Recipient email is missing' });
      }

      let emailPayload = {
        to: recipientEmail,
        subject: notif.content?.subject || 'BusBook Notification',
        text: notif.content?.message || '',
        html: notif.content?.message || '',
      };

      if (notif.booking) {
        try {
          const booking = await Booking.findById(notif.booking).populate('bus').populate('user');
          if (booking) {
            const isGuardian = notif.recipient?.relationship && !notif.recipient.relationship.includes('Self');
            const bus = booking.bus || {};
            const user = booking.user || {};
            const commonDetails = {
              passengerName: booking.passengerDetails?.[0]?.name || user.name || 'Passenger',
              safetyContactName: notif.recipient?.name || user.guardian?.name || 'Contact',
              recipientRole: isGuardian ? 'Guardian' : 'Passenger',
              route: `${booking.from} → ${booking.to}`,
              from: booking.from,
              to: booking.to,
              busName: booking.busName || bus.busName || 'BusBook Express',
              busNumber: bus.busNumber || bus.operator || 'BB-EXPRESS',
              travelDate: booking.travelDate,
              departureTime: booking.departureTime || bus.departureTime || 'Scheduled Time',
              arrivalTime: booking.arrivalTime || bus.arrivalTime || '',
              seat: (booking.seats || []).join(', '),
              bookingId: String(booking._id).slice(-8).toUpperCase(),
              bookingStatus: booking.status || 'CONFIRMED',
              paymentStatus: booking.paymentStatus || 'SUCCESS',
              amountPaid: booking.totalAmount || 0,
              qrCode: booking.qrCode || '',
            };

            let tpl;
            if (notif.type === 'BOOKING_CONFIRMATION') {
              tpl = emailService.templates.bookingConfirmation(commonDetails);
            } else if (notif.type === 'TRAVEL_REMINDER') {
              tpl = emailService.templates.travelReminder(commonDetails);
            } else if (notif.type === 'PASSENGER_BOARDED') {
              tpl = emailService.templates.passengerBoarded({ ...commonDetails, boardedAt: booking.boardedAt });
            } else if (notif.type === 'BOOKING_CANCELLED') {
              tpl = emailService.templates.bookingCancelled(commonDetails);
            }

            if (tpl) {
              emailPayload.subject = tpl.subject;
              emailPayload.text = tpl.text;
              emailPayload.html = tpl.html;
            }
          }
        } catch (e) {
          console.warn('Failed to rebuild template during retry:', e.message);
        }
      }

      const sendRes = await emailService.sendEmail(emailPayload);

      if (sendRes.success) {
        notif.status = sendRes.status || 'ACCEPTED';
        notif.sentAt = new Date();
        notif.providerMessageId = sendRes.messageId || null;
        notif.error = null;
      } else {
        notif.status = 'FAILED';
        notif.error = sendRes.error || 'Retry failed';
      }
      await notif.save();

      return res.json({
        success: sendRes.success,
        message: sendRes.success ? 'Notification resent successfully' : `Retry failed: ${sendRes.error}`,
        notification: notif,
      });
    }

    res.status(400).json({ success: false, message: `Retry for channel ${notif.channel} not supported. Only Email notifications are active.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Retry operation failed', error: error.message });
  }
});

// 7. System & Manager Performance Reports
router.get('/reports', requireAdmin, async (req, res) => {
  try {
    const managers = await User.find({ role: { $in: MANAGER_ROLES } }).select('name email managerCode');

    const managerReports = await Promise.all(
      managers.map(async (m) => {
        const [connectedUsers, totalTickets, emergencyTickets, revenue] = await Promise.all([
          User.countDocuments({ manager: m._id }),
          Booking.countDocuments({ manager: m._id }),
          Booking.countDocuments({ manager: m._id, bookingType: { $in: ['EMERGENCY', 'emergency'] } }),
          Payment.aggregate([
            { $lookup: { from: 'bookings', localField: 'booking', foreignField: '_id', as: 'b' } },
            { $unwind: '$b' },
            { $match: { 'b.manager': m._id, status: { $in: ['SUCCESS', 'success'] } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
        ]);

        return {
          managerId: m._id,
          name: m.name,
          email: m.email,
          managerCode: m.managerCode,
          connectedUsers,
          totalTickets,
          emergencyTickets,
          revenue: revenue[0]?.total || 0,
        };
      })
    );

    res.json({ success: true, reports: managerReports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate reports', error: error.message });
  }
});

// 8. Audit Logs
router.get('/audit-logs', requireAdmin, async (req, res) => {
  try {
    const logs = await AuditLog.find({}).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch audit logs', error: error.message });
  }
});

// 9. Registered Users list (for Admin Users table)
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({
      role: { $in: ['CUSTOMER', 'customer', 'user', 'USER'] },
    })
      .select('-password')
      .populate('manager', 'name email managerCode')
      .sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const bookingCount = await Booking.countDocuments({ user: u._id });
        return {
          ...u.toObject(),
          bookingCount,
        };
      })
    );

    res.json({ success: true, users: usersWithStats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users', error: error.message });
  }
});

// 10. Analytics (for Admin Dashboard and Finance Manager Analytics)
router.get('/analytics', requireRole('ADMIN', 'FINANCE_MANAGER', 'MANAGER'), async (req, res) => {
  try {
    const [bookingsOverTime, revenueOverTime, popularRoutes, userRegistrations] = await Promise.all([
      Booking.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]),
      Payment.aggregate([
        { $match: { status: { $in: ['SUCCESS', 'success'] } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$amount' },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]),
      Booking.aggregate([
        {
          $group: {
            _id: { $concat: ['$from', ' → ', '$to'] },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      User.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 14 },
      ]),
    ]);

    res.json({
      success: true,
      analytics: {
        bookingsOverTime,
        revenueOverTime,
        popularRoutes,
        userRegistrations,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch analytics', error: error.message });
  }
});

// =========================================================================
// BUS FLEET & BOOKING MANAGEMENT (Admin & authorized staff)
// =========================================================================

router.get('/buses', requireRole('ADMIN', 'BUS_MANAGER'), async (req, res) => {
  try {
    const buses = await Bus.find({}).sort({ createdAt: -1 });
    res.json({ success: true, buses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch buses', error: error.message });
  }
});

router.post('/buses', requireRole('ADMIN', 'BUS_MANAGER'), async (req, res) => {
  try {
    const bus = await Bus.create(req.body);
    await logAuditAction(req, 'CREATE_BUS', 'BUS', bus._id, {
      busName: bus.busName,
      route: `${bus.from} -> ${bus.to}`,
    });
    res.status(201).json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create bus', error: error.message });
  }
});

router.put('/buses/:id', requireRole('ADMIN', 'BUS_MANAGER'), async (req, res) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    await logAuditAction(req, 'UPDATE_BUS', 'BUS', bus._id, { busName: bus.busName });
    res.json({ success: true, bus });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update bus', error: error.message });
  }
});

router.delete('/buses/:id', requireRole('ADMIN', 'BUS_MANAGER'), async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });
    await logAuditAction(req, 'DELETE_BUS', 'BUS', req.params.id, { busName: bus.busName });
    res.json({ success: true, message: 'Bus deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete bus', error: error.message });
  }
});

router.get('/bookings', requireRole('ADMIN', 'BOOKING_MANAGER'), async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('user', 'name email phone')
      .populate('manager', 'name email phone managerCode')
      .populate('bus')
      .sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings', error: error.message });
  }
});

// Update Booking Status (Called by Booking Manager / Admin)
router.patch('/bookings/:id/status', requireRole('ADMIN', 'BOOKING_MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const booking = await Booking.findById(req.params.id).populate('bus').populate('user');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const prevStatus = booking.status;
    booking.status = status.toUpperCase();

    // If cancelled, release seats from trip & bus inventory
    if (booking.status === 'CANCELLED' && prevStatus !== 'CANCELLED') {
      booking.cancellationDate = new Date().toISOString().split('T')[0];
      if (booking.trip) {
        await tripService.releaseSeats({
          tripId: booking.trip,
          seats: booking.seats,
        }).catch(() => {});
      }
      const bus = await Bus.findById(booking.bus?._id || booking.bus);
      if (bus && Array.isArray(bus.bookedSeats)) {
        const seatNums = (booking.seats || []).map(Number);
        bus.bookedSeats = bus.bookedSeats.filter((s) => !seatNums.includes(Number(s)));
        bus.availableSeats = Math.min(bus.totalSeats || 40, (bus.availableSeats || 0) + seatNums.length);
        await bus.save().catch(() => {});
      }
    }

    if (booking.status === 'BOARDED' || status.toUpperCase() === 'BOARDED') {
      booking.boardingStatus = 'BOARDED';
      booking.boardedAt = new Date();
      try {
        await notificationService.sendPassengerBoarded(booking, { boardedAt: booking.boardedAt });
      } catch (e) {
        console.error('Failed to dispatch passenger boarded alert:', e.message);
      }
    }

    await booking.save();

    await logAuditAction(req, 'UPDATE_BOOKING_STATUS', 'BOOKING', booking._id, {
      from: prevStatus,
      to: booking.status,
    });

    res.json({ success: true, message: `Booking status updated to ${booking.status}`, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update booking status', error: error.message });
  }
});

router.get('/emergency', requireRole('ADMIN', 'BOOKING_MANAGER'), async (req, res) => {
  try {
    const emergencyBookings = await Booking.find({ bookingType: { $in: ['EMERGENCY', 'emergency'] } })
      .populate('user', 'name email phone')
      .populate('manager', 'name email managerCode')
      .populate('bus')
      .sort({ createdAt: -1 });

    res.json({ success: true, emergencyBookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch emergency bookings', error: error.message });
  }
});

// Update Emergency Request Status (Called by Booking Manager / Admin)
router.patch('/emergency/:id/status', requireRole('ADMIN', 'BOOKING_MANAGER'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Emergency booking not found' });
    }

    booking.status = status.toUpperCase();
    await booking.save();

    await logAuditAction(req, 'UPDATE_EMERGENCY_STATUS', 'BOOKING', booking._id, {
      status: booking.status,
    });

    res.json({ success: true, message: `Emergency request status updated to ${booking.status}`, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update emergency status', error: error.message });
  }
});

router.get('/payments', requireRole('ADMIN', 'FINANCE_MANAGER'), async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate('user', 'name email phone')
      .populate('booking')
      .sort({ createdAt: -1 });
    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch payments', error: error.message });
  }
});

router.get('/payments/export', requireRole('ADMIN', 'FINANCE_MANAGER'), async (req, res) => {
  try {
    const payments = await Payment.find({})
      .populate('user', 'name email phone')
      .populate('booking')
      .sort({ createdAt: -1 });

    const csvHeaders = 'Transaction ID,Booking ID,Customer Name,Customer Email,Amount (INR),Payment Mode,Status,Date\n';
    const csvRows = payments
      .map((p) => {
        const date = p.createdAt ? new Date(p.createdAt).toISOString() : '';
        const user = p.user?.name ? `"${p.user.name.replace(/"/g, '""')}"` : 'Guest';
        const email = p.user?.email || '';
        const bookingId = p.booking?._id || p.booking || '';
        const txnId = p.transactionId || p._id;
        return `${txnId},${bookingId},${user},${email},${p.amount || 0},${p.paymentMode || 'UPI'},${p.status || 'SUCCESS'},${date}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="financial-report.csv"');
    res.send(csvHeaders + csvRows);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to export report', error: error.message });
  }
});

// Platform Settings (Admin Configuration)
const Setting = require('../models/Setting');

router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const settingsDoc = await Setting.findOne({ key: 'platform_settings' });
    const settings = settingsDoc ? settingsDoc.value : {
      bookingApproval: true,
      autoCancellation: true,
      emergencySeatHold: true,
    };
    res.json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load settings', error: error.message });
  }
});

router.put('/settings', requireAdmin, async (req, res) => {
  try {
    const { bookingApproval, autoCancellation, emergencySeatHold } = req.body;
    let settingsDoc = await Setting.findOne({ key: 'platform_settings' });
    const current = settingsDoc?.value || { bookingApproval: true, autoCancellation: true, emergencySeatHold: true };

    const updated = {
      bookingApproval: bookingApproval !== undefined ? Boolean(bookingApproval) : current.bookingApproval,
      autoCancellation: autoCancellation !== undefined ? Boolean(autoCancellation) : current.autoCancellation,
      emergencySeatHold: emergencySeatHold !== undefined ? Boolean(emergencySeatHold) : current.emergencySeatHold,
    };

    if (!settingsDoc) {
      settingsDoc = await Setting.create({ key: 'platform_settings', value: updated, description: 'Platform operational settings' });
    } else {
      settingsDoc.value = updated;
      await settingsDoc.save();
    }

    await logAuditAction(req, 'UPDATE_PLATFORM_SETTINGS', 'SETTINGS', 'SYSTEM', updated);
    res.json({ success: true, message: 'Settings saved successfully', settings: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save settings', error: error.message });
  }
});

// Trigger daily travel reminders
const notificationService = require('../services/notificationService');
router.post('/reminders/run', requireAdmin, async (req, res) => {
  try {
    const result = await notificationService.dispatchScheduledTravelReminders();
    res.json({
      success: true,
      message: `Travel day reminders processed. Dispatched: ${result.dispatchedCount} / Checked: ${result.totalChecked}`,
      result,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to run reminders', error: error.message });
  }
});

module.exports = router;
