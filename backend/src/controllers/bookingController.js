const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const Bus = require('../models/Bus');
const User = require('../models/User');
const Trip = require('../models/Trip');
const AuditLog = require('../models/AuditLog');
const tripService = require('../services/tripService');
const Payment = require('../models/Payment');
const notificationService = require('../services/notificationService');
const { calculateFare } = require('./paymentController');

const getBookings = async (req, res) => {
  try {
    const { status } = req.query;

    const filter = {
      user: req.user._id,
    };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const bookings = await Booking.find(filter)
      .populate('bus')
      .populate('manager', 'name email phone managerCode')
      .sort({ createdAt: -1 });

    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch bookings', error: error.message });
  }
};

const getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user._id,
    })
      .populate('bus')
      .populate('manager', 'name email phone managerCode');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch booking', error: error.message });
  }
};

const createBooking = async (req, res) => {
  try {
    const {
      busId,
      travelDate,
      selectedSeats,
      totalAmount,
      passengerDetails,
      paymentMode,
      bookingType,
      emergencyReason,
      priorityLevel,
      safetyContact,
    } = req.body;

    // Check user authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Connect customer with an active manager if not already connected
    const customer = await User.findById(req.user._id);
    if (!customer.manager && req.user.role !== 'ADMIN') {
      const activeManager = await User.findOne({
        role: { $in: ['booking_manager', 'BOOKING_MANAGER', 'manager', 'MANAGER'] },
        isActive: true,
      });
      if (activeManager) {
        customer.manager = activeManager._id;
        await customer.save();
      }
    }

    // Input validation
    if (!busId || !travelDate || !selectedSeats || selectedSeats.length === 0) {
      return res.status(400).json({
        message: 'Bus, travel date, and seats are required',
      });
    }

    if (!passengerDetails || !Array.isArray(passengerDetails) || passengerDetails.length === 0) {
      return res.status(400).json({ message: 'Passenger details are required' });
    }

    if (passengerDetails.length !== selectedSeats.length) {
      return res.status(400).json({
        message: `Passenger count (${passengerDetails.length}) must match selected seats (${selectedSeats.length})`,
      });
    }

    // Safety Contact Validation
    const effectiveSafetyContact = safetyContact || {
      name: passengerDetails[0]?.name || 'Parent / Contact',
      relationship: 'Family',
      phone: passengerDetails[0]?.phone || customer.phone || '',
      email: passengerDetails[0]?.email || customer.email || '',
      notificationPreferences: { email: true, whatsapp: true },
    };

    if (!effectiveSafetyContact.name || !effectiveSafetyContact.phone) {
      return res.status(400).json({
        message: 'Safety Contact name and mobile number are required for travel security.',
      });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found', busId });
    }

    // Seat numbers conversion
    const requestedSeats = selectedSeats.map((seat) => {
      const seatNum = Number(seat);
      if (isNaN(seatNum)) throw new Error(`Invalid seat number: ${seat}`);
      return seatNum;
    });

    const isEmergency = String(bookingType || '').toUpperCase() === 'EMERGENCY';

    // Emergency Booking Rules (Section 14 & 15)
    if (isEmergency) {
      const eligibility = tripService.checkEmergencyBookingEligibility(travelDate);
      if (!eligibility.eligible) {
        return res.status(400).json({
          success: false,
          message: eligibility.message,
        });
      }

      if (requestedSeats.length > 2) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 2 emergency seats can be booked per request.',
        });
      }
    }

    // Dynamic Trip lookup / initialization for date-specific inventory
    const trip = await tripService.getOrCreateTrip({ busId: bus._id, travelDate });

    // CRITICAL: Atomic seat booking to eliminate race conditions
    await tripService.atomicReserveSeats({
      tripId: trip._id,
      seats: requestedSeats,
      isEmergency,
    });

    // Server-side fare calculation (Never trust client pricing)
    const pricing = calculateFare(bus, requestedSeats);
    const expectedTotalAmount = Number(totalAmount ?? pricing.total);

    // Generate unique ticket token & QR code
    const ticketToken = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const qrPayload = JSON.stringify({
      t: ticketToken,
      b: bus.busName,
      r: `${bus.from}->${bus.to}`,
      d: travelDate,
      s: requestedSeats,
      u: customer.name,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload);

    // Create booking assigned to customer's manager
    const booking = await Booking.create({
      user: customer._id,
      manager: customer.manager || null, // Server sets booking.manager directly from database
      bus: bus._id,
      trip: trip._id,
      busName: bus.busName,
      from: bus.from,
      to: bus.to,
      travelDate,
      departureTime: bus.departureTime || '08:00',
      arrivalTime: bus.arrivalTime || '16:00',
      seats: requestedSeats,
      passengerCount: selectedSeats.length,
      passengerDetails,
      safetyContact: effectiveSafetyContact,
      fare: pricing.subtotal,
      totalAmount: expectedTotalAmount,
      farePerSeat: pricing.farePerSeat,
      paymentMode: paymentMode || 'UPI',
      paymentStatus: 'pending',
      status: 'CONFIRMED', // Set confirmed upon successful reservation
      ticketToken,
      qrCode: qrCodeDataUrl,
      bookingType: isEmergency ? 'EMERGENCY' : 'NORMAL',
      emergencyReason: isEmergency ? emergencyReason || 'Urgent Work' : null,
      priorityLevel: isEmergency ? priorityLevel || 'high' : 'normal',
    });

    // Dispatch Safety Notification only after verified payment
    if (booking.paymentStatus === 'SUCCESS' || booking.paymentStatus === 'completed') {
      try {
        await notificationService.sendBookingConfirmation(booking);
      } catch (notifErr) {
        console.error('Safety notification error:', notifErr.message);
      }
    }

    // Record in Audit Log
    await AuditLog.create({
      action: isEmergency ? 'CREATE_EMERGENCY_BOOKING' : 'CREATE_BOOKING',
      performedBy: { id: customer._id, name: customer.name, email: customer.email, role: 'CUSTOMER' },
      targetType: 'BOOKING',
      targetId: String(booking._id),
      details: {
        route: `${bus.from} -> ${bus.to}`,
        travelDate,
        seats: requestedSeats,
        totalAmount: expectedTotalAmount,
        managerId: customer.manager,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Booking created successfully and safety alert dispatched.',
      bookingId: booking._id,
      booking,
    });
  } catch (error) {
    console.error('Booking creation error:', error);
    res.status(409).json({ success: false, message: error.message });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'cancelled') {
      return res.status(400).json({ message: 'Booking is already cancelled' });
    }

    // 1. Release seats from trip inventory
    if (booking.trip) {
      await tripService.releaseSeats({
        tripId: booking.trip,
        seats: booking.seats,
      });
    }

    // 2. Release seats from bus model inventory
    if (booking.bus) {
      const bus = await Bus.findById(booking.bus);
      if (bus && Array.isArray(bus.bookedSeats)) {
        const seatNumbers = (booking.seats || []).map(Number);
        bus.bookedSeats = bus.bookedSeats.filter((s) => !seatNumbers.includes(Number(s)));
        bus.availableSeats = Math.min(bus.totalSeats, Number(bus.availableSeats || 0) + seatNumbers.length);
        await bus.save();
      }
    }

    // 3. Mark booking as cancelled and handle refund state
    booking.status = 'CANCELLED';
    booking.cancellationDate = new Date().toISOString().split('T')[0];
    if (booking.paymentStatus === 'SUCCESS' || booking.paymentStatus === 'completed') {
      booking.paymentStatus = 'REFUND_PENDING';
      await Payment.updateMany(
        { booking: booking._id },
        { status: 'REFUND_PENDING' }
      );
    }
    await booking.save();

    // 4. Dispatch cancellation notification to customer and guardian
    try {
      await notificationService.sendBookingCancelled(booking, {
        refundStatus: booking.paymentStatus === 'REFUND_PENDING' ? 'Initiated (Processing Refund)' : 'No Payment Charged',
        amount: booking.totalAmount || 0,
      });
    } catch (notifErr) {
      console.error('Cancellation notification dispatch error:', notifErr.message);
    }

    await AuditLog.create({
      action: 'CANCEL_BOOKING',
      performedBy: { id: req.user._id, name: req.user.name, email: req.user.email, role: 'CUSTOMER' },
      targetType: 'BOOKING',
      targetId: String(booking._id),
      details: { seats: booking.seats, totalAmount: booking.totalAmount },
    });

    res.json({ success: true, message: 'Booking cancelled successfully. Seats released and notifications dispatched.', booking });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel booking', error: error.message });
  }
};

module.exports = {
  getBookings,
  getBookingById,
  createBooking,
  cancelBooking,
};