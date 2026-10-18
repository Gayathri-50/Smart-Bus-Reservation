const QRCode = require('qrcode');
const Bus = require('../models/Bus');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Trip = require('../models/Trip');
const AuditLog = require('../models/AuditLog');
const tripService = require('../services/tripService');
const notificationService = require('../services/notificationService');

const getEmergencyBuses = async (req, res) => {
  try {
    const { from, to, travelDate } = req.query;

    if (!from || !to || !travelDate) {
      return res.status(400).json({ message: 'From, destination, and travel date are required' });
    }

    // Check emergency window eligibility (strictly 1 day before trip)
    const eligibility = tripService.checkEmergencyBookingEligibility(travelDate);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: eligibility.message,
        closed: true,
      });
    }

    const buses = await Bus.find({
      $or: [
        { from: new RegExp(`^${from}$`, 'i'), to: new RegExp(`^${to}$`, 'i') },
        { routeCities: { $all: [from, to] } },
      ],
      availableSeats: { $gt: 0 },
    }).sort({ availableSeats: -1, fare: 1 });

    res.json(buses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch emergency buses', error: error.message });
  }
};

const createEmergencyBooking = async (req, res) => {
  try {
    const {
      busId,
      travelDate,
      selectedSeats,
      passengerDetails,
      emergencyReason,
      priorityLevel,
      paymentMode,
      safetyContact,
    } = req.body;

    // Check user authentication
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Check customer manager connection
    const customer = await User.findById(req.user._id);
    if (!customer.manager && req.user.role !== 'ADMIN') {
      const activeManager = await User.findOne({
        role: { $in: ['booking_manager', 'BOOKING_MANAGER', 'manager', 'MANAGER', 'admin', 'ADMIN'] },
        isActive: true,
      });
      if (activeManager) {
        customer.manager = activeManager._id;
        await customer.save();
      }
    }

    if (!busId || !travelDate || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
      return res.status(400).json({ message: 'Bus, travel date and seats are required' });
    }

    if (!Array.isArray(passengerDetails) || passengerDetails.length !== selectedSeats.length) {
      return res.status(400).json({ message: 'Passenger details must match the number of selected seats' });
    }

    if (!emergencyReason) {
      return res.status(400).json({ message: 'Emergency reason is required' });
    }

    // Emergency window validation (Rule 14)
    const eligibility = tripService.checkEmergencyBookingEligibility(travelDate);
    if (!eligibility.eligible) {
      return res.status(400).json({ success: false, message: eligibility.message });
    }

    const requestedSeats = [...new Set(selectedSeats.map(Number))];
    if (requestedSeats.length > 2) {
      return res.status(400).json({ message: 'Maximum 2 emergency seats can be booked per request.' });
    }

    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ message: 'Bus not found' });

    // Dynamic Trip lookup / initialization
    const trip = await tripService.getOrCreateTrip({ busId: bus._id, travelDate });

    // Atomic Emergency Seat locking (seats 39 & 40)
    await tripService.atomicReserveSeats({
      tripId: trip._id,
      seats: requestedSeats,
      isEmergency: true,
    });

    const normalizedPassengers = passengerDetails.map((passenger) => ({
      name: String(passenger.name || '').trim(),
      email: String(passenger.email || '').trim(),
      phone: String(passenger.phone || '').trim(),
      age: passenger.age ? Number(passenger.age) : undefined,
      gender: passenger.gender || undefined,
    }));

    const effectiveSafetyContact = safetyContact || {
      name: normalizedPassengers[0]?.name || 'Parent / Contact',
      relationship: 'Family',
      phone: normalizedPassengers[0]?.phone || customer.phone || '',
      email: normalizedPassengers[0]?.email || customer.email || '',
      notificationPreferences: { email: true, whatsapp: true },
    };

    const fare = bus.fare * requestedSeats.length;
    const priorityFee = 100 * requestedSeats.length;
    const totalAmount = fare + priorityFee;

    const ticketToken = `EMG-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const qrPayload = JSON.stringify({
      t: ticketToken,
      b: bus.busName,
      r: `${bus.from}->${bus.to}`,
      d: travelDate,
      s: requestedSeats,
      u: customer.name,
      type: 'EMERGENCY',
    });
    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload);

    const booking = await Booking.create({
      user: customer._id,
      manager: customer.manager || null, // Server enforces booking.manager
      bus: bus._id,
      trip: trip._id,
      busName: bus.busName,
      from: bus.from,
      to: bus.to,
      travelDate,
      departureTime: bus.departureTime,
      arrivalTime: bus.arrivalTime,
      seats: requestedSeats,
      passengerCount: requestedSeats.length,
      passengerDetails: normalizedPassengers,
      safetyContact: effectiveSafetyContact,
      fare,
      totalAmount,
      farePerSeat: bus.fare,
      bookingType: 'EMERGENCY',
      emergencyReason,
      priorityLevel: priorityLevel || 'critical',
      priorityFee,
      paymentMode: paymentMode || 'UPI',
      paymentStatus: 'pending',
      status: 'CONFIRMED',
      ticketToken,
      qrCode: qrCodeDataUrl,
    });

    // Send Safety Notification
    try {
      await notificationService.sendBookingConfirmation(booking);
    } catch (notifErr) {
      console.error('Safety notification error:', notifErr.message);
    }

    await AuditLog.create({
      action: 'CREATE_EMERGENCY_BOOKING',
      performedBy: { id: customer._id, name: customer.name, email: customer.email, role: 'CUSTOMER' },
      targetType: 'BOOKING',
      targetId: String(booking._id),
      details: {
        seats: requestedSeats,
        reason: emergencyReason,
        managerId: customer.manager,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Emergency priority reservation created successfully and safety alert dispatched',
      bookingId: booking._id,
      booking,
    });
  } catch (error) {
    console.error('Emergency booking error:', error);
    res.status(409).json({ success: false, message: error.message });
  }
};

module.exports = { getEmergencyBuses, createEmergencyBooking };
