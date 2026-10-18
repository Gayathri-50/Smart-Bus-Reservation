const User = require('../models/User');
const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const ManagerConnection = require('../models/ManagerConnection');
const Notification = require('../models/Notification');
const { formatDateString } = require('../services/tripService');

/**
 * Manager Dashboard Statistics
 */
const getManagerDashboard = async (req, res) => {
  try {
    const managerId = req.user._id;
    const todayStr = formatDateString(new Date());

    const [
      connectedUsers,
      totalBookings,
      todayBookings,
      emergencyBookings,
      pendingRequests,
      boardedCount,
    ] = await Promise.all([
      User.countDocuments({ manager: managerId, isActive: true }),
      Booking.countDocuments({ manager: managerId }),
      Booking.countDocuments({ manager: managerId, travelDate: todayStr }),
      Booking.countDocuments({ manager: managerId, bookingType: { $in: ['EMERGENCY', 'emergency'] } }),
      ManagerConnection.countDocuments({ manager: managerId, status: 'PENDING' }),
      Booking.countDocuments({ manager: managerId, boardingStatus: 'BOARDED' }),
    ]);

    res.json({
      success: true,
      stats: {
        connectedUsers,
        totalBookings,
        todayBookings,
        emergencyBookings,
        pendingRequests,
        boardedCount,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load manager dashboard', error: err.message });
  }
};

/**
 * Connected Users list (Only users connected to this manager)
 */
const getManagerUsers = async (req, res) => {
  try {
    const managerId = req.user._id;
    const users = await User.find({ manager: managerId }).select('-password').sort({ createdAt: -1 });

    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const bookingCount = await Booking.countDocuments({ user: u._id, manager: managerId });
        const upcomingCount = await Booking.countDocuments({
          user: u._id,
          manager: managerId,
          travelDate: { $gte: formatDateString(new Date()) },
          status: { $in: ['CONFIRMED', 'confirmed'] },
        });

        return {
          ...u.toObject(),
          totalBookings: bookingCount,
          upcomingBookings: upcomingCount,
        };
      })
    );

    res.json({ success: true, users: usersWithStats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch manager users', error: err.message });
  }
};

/**
 * Bookings list (Only bookings assigned to this manager)
 */
const getManagerBookings = async (req, res) => {
  try {
    const managerId = req.user._id;
    const { status, bookingType, search } = req.query;

    const query = { manager: managerId };
    if (status && status !== 'all') {
      query.status = status;
    }
    if (bookingType && bookingType !== 'all') {
      query.bookingType = bookingType.toUpperCase();
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('bus', 'busName operator')
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch manager bookings', error: err.message });
  }
};

/**
 * Notifications list for bookings belonging to this manager
 */
const getManagerNotifications = async (req, res) => {
  try {
    const managerId = req.user._id;
    // Find booking IDs belonging to this manager
    const managerBookings = await Booking.find({ manager: managerId }).select('_id');
    const bookingIds = managerBookings.map((b) => b._id);

    const notifications = await Notification.find({ booking: { $in: bookingIds } })
      .populate({
        path: 'booking',
        select: 'from to travelDate departureTime seats passengerDetails',
      })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load notifications', error: err.message });
  }
};

module.exports = {
  getManagerDashboard,
  getManagerUsers,
  getManagerBookings,
  getManagerNotifications,
};
