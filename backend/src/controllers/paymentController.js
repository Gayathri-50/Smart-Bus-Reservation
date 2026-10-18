const crypto = require('crypto');
const Razorpay = require('razorpay');
const QRCode = require('qrcode');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');
const tripService = require('../services/tripService');
const notificationService = require('../services/notificationService');

const getRazorpayConfig = () => {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();

  return {
    keyId,
    keySecret,
    configured: Boolean(keyId && keySecret),
  };
};

const getRazorpayClient = () => {
  const { configured, keyId, keySecret } = getRazorpayConfig();

  if (!configured) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const ensureRazorpayConfigured = (res) => {
  if (!getRazorpayConfig().configured) {
    return res.status(503).json({
      success: false,
      message: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to backend/.env to enable payments.',
    });
  }

  return null;
};

const toNumbers = (seats = []) => {
  const uniqueSeats = [...new Set((Array.isArray(seats) ? seats : []).map((seat) => Number(seat)).filter((seat) => !Number.isNaN(seat)))];
  return uniqueSeats;
};

const calculateFare = (bus, selectedSeats = []) => {
  const seatCount = toNumbers(selectedSeats).length;
  const baseFare = Number(bus?.fare || 0) * seatCount;
  const serviceFee = Math.round(baseFare * 0.05);
  const taxes = Math.round(baseFare * 0.08);
  const total = baseFare + serviceFee + taxes;

  return {
    farePerSeat: Number(bus?.fare || 0),
    subtotal: baseFare,
    serviceFee,
    taxes,
    total,
  };
};

const createOrder = async (req, res) => {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return ensureRazorpayConfigured(res);
    }

    const {
      busId,
      travelDate,
      selectedSeats,
      passengerDetails,
      paymentMode,
      totalAmount,
    } = req.body;

    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!busId || !travelDate || !selectedSeats || !Array.isArray(selectedSeats) || selectedSeats.length === 0) {
      return res.status(400).json({ message: 'Bus, travel date and seats are required' });
    }

    if (!Array.isArray(passengerDetails) || passengerDetails.length === 0) {
      return res.status(400).json({ message: 'Passenger details are required' });
    }

    if (passengerDetails.length !== selectedSeats.length) {
      return res.status(400).json({ message: 'Passenger count must match selected seats' });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: 'Bus not found' });
    }

    const requestedSeats = toNumbers(selectedSeats);
    if (requestedSeats.length !== selectedSeats.length) {
      return res.status(400).json({ message: 'Duplicate or invalid seats are not allowed' });
    }

    const invalidSeat = requestedSeats.some((seat) => seat < 1 || seat > bus.totalSeats);
    if (invalidSeat) {
      return res.status(400).json({ message: 'One or more selected seats are invalid' });
    }

    if (bus.totalSeats >= 40 && requestedSeats.some((s) => s === 39 || s === 40)) {
      return res.status(400).json({ message: 'Seats 39 and 40 are reserved for Emergency Priority Bookings' });
    }

    const trip = await tripService.getOrCreateTrip({ busId: bus._id, travelDate });
    const tripBookedSeats = Array.isArray(trip.bookedSeats) ? trip.bookedSeats.map(Number) : [];
    const tripOverlap = requestedSeats.filter((seat) => tripBookedSeats.includes(seat));
    if (tripOverlap.length > 0) {
      return res.status(409).json({
        message: 'One or more selected seats are already booked for this travel date',
        unavailableSeats: tripOverlap,
      });
    }

    const bookedSeats = Array.isArray(bus.bookedSeats) ? bus.bookedSeats.map(Number) : [];
    const blockedSeatOverlap = requestedSeats.filter((seat) => bookedSeats.includes(seat));
    if (blockedSeatOverlap.length > 0) {
      return res.status(409).json({
        message: 'One or more selected seats are already booked',
        unavailableSeats: blockedSeatOverlap,
      });
    }

    // Auto-expire abandoned pending reservations older than 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    await Booking.updateMany(
      {
        bus: bus._id,
        travelDate,
        status: 'PENDING_PAYMENT',
        createdAt: { $lt: fifteenMinutesAgo },
      },
      { status: 'EXPIRED' }
    );

    const activeSeatBookings = await Booking.find({
      bus: bus._id,
      travelDate,
      status: { $in: ['PENDING_PAYMENT', 'PAYMENT_SUCCESS', 'CONFIRMED', 'pending', 'confirmed', 'completed'] },
      seats: { $in: requestedSeats },
    }).select('_id seats status paymentStatus razorpayOrderId');

    const overlappingSeats = [...new Set(activeSeatBookings.flatMap((booking) => booking.seats.map(Number)).filter((seat) => requestedSeats.includes(seat)))];
    if (overlappingSeats.length > 0) {
      return res.status(409).json({
        message: 'Some selected seats are currently locked for payment or already reserved',
        unavailableSeats: overlappingSeats,
      });
    }

    const pricing = calculateFare(bus, requestedSeats);
    const expectedTotal = Number(totalAmount ?? pricing.total);
    if (Math.abs(expectedTotal - pricing.total) > 1.0) {
      return res.status(400).json({
        message: 'Booking amount is invalid',
        expectedAmount: pricing.total,
        receivedAmount: expectedTotal,
      });
    }

    const existingBooking = await Booking.findOne({
      user: req.user._id,
      bus: bus._id,
      travelDate,
      status: 'PENDING_PAYMENT',
      seats: { $in: requestedSeats },
    }).sort({ createdAt: -1 });

    if (existingBooking && existingBooking.razorpayOrderId) {
      return res.status(200).json({
        success: true,
        message: 'Payment already in progress for this booking.',
        bookingId: existingBooking._id,
        booking: existingBooking,
        order: {
          id: existingBooking.razorpayOrderId,
          amount: Math.round((existingBooking.totalAmount || pricing.total) * 100),
          currency: 'INR',
          key: process.env.RAZORPAY_KEY_ID,
        },
      });
    }

    const normalizedPassengers = passengerDetails.map((passenger) => ({
      name: String(passenger.name || '').trim(),
      email: String(passenger.email || '').trim(),
      phone: String(passenger.phone || '').trim(),
      age: passenger.age ? Number(passenger.age) : undefined,
      gender: passenger.gender || undefined,
    }));

    if (normalizedPassengers.some((passenger) => !passenger.name || !passenger.email || !passenger.phone)) {
      return res.status(400).json({ message: 'Name, email and phone are required for every passenger' });
    }

    const incomingContact = req.body.safetyContact || req.body.guardian || {};
    const safetyContact = {
      name: String(incomingContact.name || req.user?.guardian?.name || 'Parent / Guardian').trim(),
      phone: String(incomingContact.phone || req.user?.guardian?.phone || '').trim(),
      email: String(incomingContact.email || req.user?.guardian?.email || '').trim(),
      relationship: String(incomingContact.relationship || req.user?.guardian?.relationship || 'Parent / Guardian').trim(),
      notificationPreferences: {
        email: incomingContact.notificationPreferences?.email !== false,
        whatsapp: incomingContact.notificationPreferences?.whatsapp !== false,
      },
    };

    // Auto-update user guardian profile if provided
    if (incomingContact.email || incomingContact.phone) {
      User.findByIdAndUpdate(req.user._id, {
        guardian: {
          name: safetyContact.name,
          phone: safetyContact.phone,
          email: safetyContact.email,
          relationship: safetyContact.relationship,
        },
      }).catch(() => {});
    }

    let assignedManager = req.user?.manager;
    if (!assignedManager) {
      const activeManager = await User.findOne({
        role: { $in: ['booking_manager', 'BOOKING_MANAGER', 'manager', 'MANAGER'] },
        isActive: true,
      });
      if (activeManager) {
        assignedManager = activeManager._id;
        await User.findByIdAndUpdate(req.user._id, { manager: activeManager._id }).catch(() => {});
      }
    }

    const booking = await Booking.create({
      user: req.user._id,
      manager: assignedManager || null,
      safetyContact,
      bus: bus._id,
      busName: bus.busName,
      from: bus.from,
      to: bus.to,
      travelDate,
      departureTime: bus.departureTime,
      arrivalTime: bus.arrivalTime,
      seats: requestedSeats,
      passengerCount: requestedSeats.length,
      passengerDetails: normalizedPassengers,
      fare: pricing.subtotal,
      totalAmount: pricing.total,
      farePerSeat: bus.fare,
      paymentMode: paymentMode || 'UPI',
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
    });

    const order = await razorpay.orders.create({
      amount: Math.round(pricing.total * 100),
      currency: 'INR',
      receipt: booking._id.toString(),
      notes: {
        userId: req.user._id.toString(),
        busId: bus._id.toString(),
        seats: requestedSeats.join(','),
      },
    });

    booking.razorpayOrderId = order.id;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Razorpay order created successfully',
      bookingId: booking._id,
      booking,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
};

const verifyPayment = async (req, res) => {
  try {
    const { configured, keySecret } = getRazorpayConfig();
    if (!configured) {
      return ensureRazorpayConfigured(res);
    }

    const {
      bookingId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = req.body;

    if (!bookingId || !razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay payment information' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ message: 'Payment order mismatch' });
    }

    const generatedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      booking.status = 'PAYMENT_FAILED';
      booking.paymentStatus = 'FAILED';
      booking.razorpayPaymentId = razorpay_payment_id;
      booking.razorpaySignature = razorpay_signature;
      await booking.save();

      return res.status(400).json({ message: 'Payment verification failed. Please try again.' });
    }

    if (booking.status === 'CONFIRMED' || booking.paymentStatus === 'SUCCESS' || booking.paymentStatus === 'completed') {
      return res.status(200).json({
        success: true,
        message: 'Booking already confirmed',
        booking,
      });
    }

    const ticketToken = `BUSBOOK:TICKET:${booking._id.toString()}:${Date.now()}`;
    const qrCode = await QRCode.toDataURL(ticketToken);

    booking.status = 'CONFIRMED';
    booking.paymentStatus = 'SUCCESS';
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.razorpaySignature = razorpay_signature;
    booking.ticketToken = ticketToken;
    booking.qrCode = qrCode;
    await booking.save();

    const paymentRecord = await Payment.findOne({ booking: booking._id });
    if (paymentRecord) {
      paymentRecord.amount = booking.totalAmount;
      paymentRecord.paymentMode = booking.paymentMode;
      paymentRecord.status = 'SUCCESS';
      paymentRecord.transactionId = razorpay_payment_id;
      paymentRecord.razorpayOrderId = razorpay_order_id;
      paymentRecord.razorpayPaymentId = razorpay_payment_id;
      paymentRecord.razorpaySignature = razorpay_signature;
      await paymentRecord.save();
    } else {
      await Payment.create({
        user: req.user._id,
        booking: booking._id,
        amount: booking.totalAmount,
        paymentMode: booking.paymentMode,
        status: 'SUCCESS',
        transactionId: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
      });
    }

    const bus = await Bus.findById(booking.bus);
    if (bus) {
      const seatNumbers = booking.seats.map(Number);
      const existingBookedSeats = Array.isArray(bus.bookedSeats) ? bus.bookedSeats.map(Number) : [];
      const uniqueNewSeats = seatNumbers.filter((seat) => !existingBookedSeats.includes(seat));
      if (uniqueNewSeats.length > 0) {
        bus.bookedSeats = [...existingBookedSeats, ...uniqueNewSeats];
        bus.availableSeats = Math.max(0, Number(bus.availableSeats || 0) - uniqueNewSeats.length);
        await bus.save();
      }
    }

    // Sync seats to date-specific Trip inventory
    try {
      const trip = await tripService.getOrCreateTrip({ busId: booking.bus, travelDate: booking.travelDate });
      if (trip) {
        const existingTripSeats = Array.isArray(trip.bookedSeats) ? trip.bookedSeats.map(Number) : [];
        const seatNumbers = booking.seats.map(Number);
        const mergedSeats = [...new Set([...existingTripSeats, ...seatNumbers])];
        trip.bookedSeats = mergedSeats;
        await trip.save();
        booking.trip = trip._id;
        await booking.save();
      }
    } catch (tripErr) {
      console.error('Failed to sync booking with trip inventory:', tripErr.message);
    }

    try {
      await notificationService.sendBookingConfirmation(booking);
    } catch (notifErr) {
      console.error('Safety notification error:', notifErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed',
      bookingId: booking._id,
      booking: {
        ...booking.toObject(),
        bookingId: booking._id,
      },
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
};

const createPayment = async (req, res) => {
  try {
    const { bookingId, paymentMode } = req.body;

    if (!bookingId) {
      return res.status(400).json({ message: 'Booking id is required' });
    }

    const booking = await Booking.findOne({
      _id: bookingId,
      user: req.user._id,
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const payment = await Payment.create({
      user: req.user._id,
      booking: booking._id,
      amount: booking.totalAmount || booking.fare,
      paymentMode: paymentMode || booking.paymentMode || 'UPI',
      status: 'SUCCESS',
      transactionId: booking.razorpayPaymentId || `TXN${Date.now()}`,
      razorpayOrderId: booking.razorpayOrderId,
      razorpayPaymentId: booking.razorpayPaymentId,
      razorpaySignature: booking.razorpaySignature,
    });

    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Payment failed', error: error.message });
  }
};

const getPayments = async (req, res) => {
  try {
    const payments = await Payment.find({
      user: req.user._id,
    })
      .populate('booking')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch payments', error: error.message });
  }
};

const processRefund = async (req, res) => {
  try {
    const { bookingId, paymentId } = req.body;
    if (!bookingId && !paymentId) {
      return res.status(400).json({ message: 'Booking ID or Payment ID is required' });
    }

    const query = bookingId ? { booking: bookingId } : { _id: paymentId };
    const payment = await Payment.findOne(query).populate('booking');
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found' });
    }

    payment.status = 'REFUNDED';
    await payment.save();

    if (payment.booking) {
      const booking = await Booking.findById(payment.booking._id);
      if (booking) {
        booking.paymentStatus = 'REFUNDED';
        await booking.save();
      }
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      payment,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to process refund', error: error.message });
  }
};

module.exports = {
  calculateFare,
  createOrder,
  verifyPayment,
  createPayment,
  getPayments,
  processRefund,
};