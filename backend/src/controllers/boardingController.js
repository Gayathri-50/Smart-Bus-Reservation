const Booking = require('../models/Booking');
const Trip = require('../models/Trip');
const AuditLog = require('../models/AuditLog');
const notificationService = require('../services/notificationService');
const { getNormalizedRole } = require('../middleware/authMiddleware');

/**
 * Scan QR code / verify ticket for passenger boarding
 */
const verifyBoarding = async (req, res) => {
  try {
    const { ticketToken, bookingId } = req.body;

    if (!ticketToken && !bookingId) {
      return res.status(400).json({ success: false, message: 'Ticket token or Booking ID is required' });
    }

    const query = {};
    if (ticketToken) query.ticketToken = ticketToken;
    else query._id = bookingId;

    const booking = await Booking.findOne(query)
      .populate('user', 'name email phone')
      .populate('manager', 'name email phone')
      .populate('bus');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Ticket not found or invalid' });
    }

    const userRole = getNormalizedRole(req.user);

    // SECURITY: If requester is a Manager, verify this booking belongs to them
    if (userRole === 'MANAGER') {
      const bookingManagerId = String(booking.manager?._id || booking.manager || '');
      if (bookingManagerId && bookingManagerId !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: This booking belongs to another manager.',
        });
      }
    }

    // Check current booking status
    if (booking.boardingStatus === 'BOARDED') {
      return res.status(400).json({
        success: false,
        message: `Passenger already boarded at ${new Date(booking.boardedAt).toLocaleTimeString()}.`,
        booking,
      });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot board: This ticket has been cancelled.',
        booking,
      });
    }

    // Mark as BOARDED
    const now = new Date();
    booking.status = 'BOARDED';
    booking.boardingStatus = 'BOARDED';
    booking.boardedAt = now;
    booking.boardedBy = req.user._id;
    await booking.save();

    // Trigger Boarding Safety Notification to Safety Contact
    try {
      await notificationService.sendPassengerBoarded(booking, { boardedAt: now });
    } catch (notifErr) {
      console.error('Boarding notification error:', notifErr.message);
    }

    await AuditLog.create({
      action: 'PASSENGER_BOARDED',
      performedBy: { id: req.user._id, name: req.user.name, email: req.user.email, role: userRole },
      targetType: 'BOARDING',
      targetId: String(booking._id),
      details: {
        passengerName: booking.passengerDetails?.[0]?.name || booking.user?.name,
        route: `${booking.from} -> ${booking.to}`,
        seat: (booking.seats || []).join(', '),
        boardedAt: now,
      },
    });

    res.json({
      success: true,
      message: 'Passenger check-in and boarding confirmed. Safety update dispatched.',
      booking,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Boarding verification failed', error: err.message });
  }
};

/**
 * Get boarding manifest for a trip / today's departures
 */
const getBoardingManifest = async (req, res) => {
  try {
    const { travelDate, busId } = req.query;
    const query = {};

    if (travelDate) query.travelDate = travelDate;
    if (busId) query.bus = busId;

    const userRole = getNormalizedRole(req.user);
    if (userRole === 'MANAGER') {
      query.manager = req.user._id;
    }

    const bookings = await Booking.find(query)
      .populate('user', 'name email phone')
      .populate('bus', 'busName from to')
      .sort({ seats: 1 });

    res.json({ success: true, manifest: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch manifest', error: err.message });
  }
};

module.exports = {
  verifyBoarding,
  getBoardingManifest,
};
