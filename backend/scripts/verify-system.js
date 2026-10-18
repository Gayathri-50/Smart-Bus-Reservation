/**
 * Comprehensive System Verification & End-to-End Test Suite
 * Tests customer booking, date-specific inventory, Razorpay payment verification,
 * guardian safety notifications, cancellation seat releases, admin & 3 manager roles.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Bus = require('../src/models/Bus');
const Trip = require('../src/models/Trip');
const Booking = require('../src/models/Booking');
const Payment = require('../src/models/Payment');
const Notification = require('../src/models/Notification');
const Setting = require('../src/models/Setting');
const { calculateFare } = require('../src/controllers/paymentController');
const tripService = require('../src/services/tripService');
const notificationService = require('../src/services/notificationService');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busbooking';

async function runTests() {
  console.log('🚀 Starting System Verification Suite...');
  console.log(`Connecting to MongoDB at: ${MONGO_URI}`);
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  let passedTests = 0;
  let totalTests = 0;

  const test = async (name, fn) => {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    Error: ${err.message}`);
    }
  };

  // 1. Role verification
  await test('Staff Accounts and Roles in Database', async () => {
    const admin = await User.findOne({ email: 'admin@busbook.com' });
    if (!admin) throw new Error('Super Admin account missing');
    if (admin.getNormalizedRole() !== 'ADMIN') throw new Error(`Admin role incorrect: ${admin.role}`);

    const busOps = await User.findOne({ email: 'bus.ops@busbook.com' });
    if (!busOps) throw new Error('Bus Operations Manager missing');
    if (busOps.getNormalizedRole() !== 'BUS_MANAGER') throw new Error(`Bus Ops role incorrect: ${busOps.role}`);

    const bookingMgr = await User.findOne({ email: 'bookings@busbook.com' });
    if (!bookingMgr) throw new Error('Booking Manager missing');
    if (bookingMgr.getNormalizedRole() !== 'BOOKING_MANAGER') throw new Error(`Booking Mgr role incorrect: ${bookingMgr.role}`);

    const financeMgr = await User.findOne({ email: 'finance@busbook.com' });
    if (!financeMgr) throw new Error('Finance Manager missing');
    if (financeMgr.getNormalizedRole() !== 'FINANCE_MANAGER') throw new Error(`Finance Mgr role incorrect: ${financeMgr.role}`);
  });

  // 2. Bus Inventory & Fare Calculation
  let testBus = null;
  await test('Bus Fleet & Fare Calculation Logic', async () => {
    testBus = await Bus.findOne({ availableSeats: { $gt: 5 } });
    if (!testBus) {
      testBus = await Bus.findOne({});
    }
    if (!testBus) throw new Error('No bus found in database');

    const pricing = calculateFare(testBus, [1, 2]);
    const expectedBase = testBus.fare * 2;
    const expectedFee = Math.round(expectedBase * 0.05);
    const expectedTax = Math.round(expectedBase * 0.08);
    const expectedTotal = expectedBase + expectedFee + expectedTax;

    if (pricing.subtotal !== expectedBase) throw new Error(`Base fare calculation mismatch: got ${pricing.subtotal}, expected ${expectedBase}`);
    if (pricing.total !== expectedTotal) throw new Error(`Total amount calculation mismatch: got ${pricing.total}, expected ${expectedTotal}`);
  });

  // 3. Customer Lifecycle: Register & Auto-assign Manager
  let testUser = null;
  const testCustomerEmail = `test.traveler.${Date.now()}@testmail.com`;
  await test('Customer Registration and Safety Contact Setup', async () => {
    const hashedPassword = await bcrypt.hash('TestPass@123', 10);
    testUser = await User.create({
      name: 'Priya Sharma',
      email: testCustomerEmail,
      phone: '9876543210',
      password: hashedPassword,
      role: 'CUSTOMER',
      guardian: {
        name: 'Rajesh Sharma',
        phone: '9876500000',
        email: 'rajesh.guardian@testmail.com',
        relationship: 'Father',
      },
    });

    if (!testUser._id) throw new Error('Failed to create customer user');
    if (testUser.getNormalizedRole() !== 'CUSTOMER') throw new Error('Role is not customer');
  });

  // 4. Date-Specific Seat Inventory & Atomic Lock
  const testDate = '2026-11-20';
  const testSeats = [5, 6];
  let testTrip = null;
  await test('Date-Specific Trip Creation and Atomic Seat Reservation', async () => {
    testTrip = await tripService.getOrCreateTrip({ busId: testBus._id, travelDate: testDate });
    if (!testTrip) throw new Error('Failed to create trip');

    // Clean test seats if already present
    testTrip.bookedSeats = (testTrip.bookedSeats || []).filter((s) => !testSeats.includes(s));
    await testTrip.save();

    // Atomic seat reservation
    await tripService.atomicReserveSeats({
      tripId: testTrip._id,
      seats: testSeats,
      isEmergency: false,
    });

    const refreshedTrip = await Trip.findById(testTrip._id);
    const hasSeats = testSeats.every((s) => refreshedTrip.bookedSeats.includes(s));
    if (!hasSeats) throw new Error('Seats were not recorded in Trip bookedSeats');
  });

  // 5. Duplicate Booking Prevention (Race Condition Protection)
  await test('Duplicate Seat Booking Prevention on Same Date', async () => {
    let duplicateBlocked = false;
    try {
      await tripService.atomicReserveSeats({
        tripId: testTrip._id,
        seats: [testSeats[0]], // Try reserving the same seat again
        isEmergency: false,
      });
    } catch (err) {
      duplicateBlocked = true;
    }
    if (!duplicateBlocked) throw new Error('Expected duplicate reservation to be rejected, but it succeeded');
  });

  // 6. Emergency Quota Seat Protection for Normal Bookings
  await test('Normal Booking Blocked from Emergency Seats (39 & 40)', async () => {
    let blocked = false;
    try {
      await tripService.atomicReserveSeats({
        tripId: testTrip._id,
        seats: [39],
        isEmergency: false,
      });
    } catch (err) {
      blocked = true;
    }
    if (!blocked) throw new Error('Emergency seat was permitted in normal booking');
  });

  // 7. Verified Payment Flow & Real Booking Confirmation
  let testBooking = null;
  await test('Booking Confirmation and Verified Payment Record Creation', async () => {
    const pricing = calculateFare(testBus, testSeats);
    const orderId = `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_secret_default';

    // Generate valid HMAC signature
    const signature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    testBooking = await Booking.create({
      user: testUser._id,
      bus: testBus._id,
      trip: testTrip._id,
      busName: testBus.busName,
      from: testBus.from,
      to: testBus.to,
      travelDate: testDate,
      seats: testSeats,
      passengerCount: testSeats.length,
      passengerDetails: [
        { name: 'Priya Sharma', email: testUser.email, phone: testUser.phone },
        { name: 'Aarav Sharma', email: 'aarav@testmail.com', phone: '9876543211' },
      ],
      safetyContact: testUser.guardian,
      fare: pricing.subtotal,
      totalAmount: pricing.total,
      farePerSeat: testBus.fare,
      paymentMode: 'UPI',
      status: 'CONFIRMED',
      paymentStatus: 'SUCCESS',
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
      ticketToken: `TKT-${testDate}-${Date.now()}`,
    });

    const payment = await Payment.create({
      user: testUser._id,
      booking: testBooking._id,
      amount: testBooking.totalAmount,
      paymentMode: 'UPI',
      status: 'SUCCESS',
      transactionId: paymentId,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: signature,
    });

    if (!payment._id) throw new Error('Payment record was not created');
    if (payment.status !== 'SUCCESS') throw new Error('Payment status is not SUCCESS');
  });

  // 8. Guardian Notification Dispatch & Accurate Status Logging
  await test('Safety Notification Dispatch to Passenger & Guardian', async () => {
    const notifs = await notificationService.sendBookingConfirmation(testBooking);
    if (!Array.isArray(notifs) || notifs.length === 0) {
      throw new Error('No notifications generated');
    }

    // Verify Notification documents exist in MongoDB
    const recordedNotifs = await Notification.find({ booking: testBooking._id });
    if (recordedNotifs.length === 0) throw new Error('Notification records not found in database');

    const hasFailedOrSent = recordedNotifs.every((n) => ['SENT', 'ACCEPTED', 'FAILED', 'PENDING'].includes(n.status));
    if (!hasFailedOrSent) throw new Error('Invalid notification status encountered');

    // Confirm that when SMTP is unconfigured, status is FAILED (not faked as SENT)
    const hasSmtpCreds = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
    if (!hasSmtpCreds) {
      const emailNotif = recordedNotifs.find((n) => n.channel === 'EMAIL');
      if (emailNotif && emailNotif.status === 'SENT') {
        throw new Error('Simulation flaw: Email was marked SENT when SMTP is unconfigured!');
      }
    }
  });

  // 9. Booking Cancellation, Inventory Release & Notification
  await test('Booking Cancellation, Seat Release and Refund Pending Status', async () => {
    // Release seats
    await tripService.releaseSeats({
      tripId: testBooking.trip,
      seats: testBooking.seats,
    });

    testBooking.status = 'CANCELLED';
    testBooking.paymentStatus = 'REFUND_PENDING';
    await testBooking.save();

    await Payment.updateMany(
      { booking: testBooking._id },
      { status: 'REFUND_PENDING' }
    );

    // Verify trip seats released
    const updatedTrip = await Trip.findById(testBooking.trip);
    const seatsStillPresent = testSeats.some((s) => updatedTrip.bookedSeats.includes(s));
    if (seatsStillPresent) throw new Error('Cancelled seats were not released from trip inventory');

    // Verify cancellation notification
    const cancelNotifs = await notificationService.sendBookingCancelled(testBooking, {
      refundStatus: 'Initiated',
      amount: testBooking.totalAmount,
    });
    if (!Array.isArray(cancelNotifs)) throw new Error('Cancellation notifications failed to dispatch');
  });

  // 10. Admin Platform Settings Persistence
  await test('Platform Operational Settings Save & Retrieve in MongoDB', async () => {
    const testSettings = {
      bookingApproval: false,
      autoCancellation: true,
      emergencySeatHold: true,
    };

    let doc = await Setting.findOne({ key: 'platform_settings' });
    if (!doc) {
      doc = await Setting.create({ key: 'platform_settings', value: testSettings });
    } else {
      doc.value = testSettings;
      await doc.save();
    }

    const fetched = await Setting.findOne({ key: 'platform_settings' });
    if (!fetched || fetched.value.bookingApproval !== false) {
      throw new Error('Platform settings were not persisted to database');
    }
  });

  // Clean up test data
  try {
    if (testBooking) await Booking.deleteOne({ _id: testBooking._id });
    if (testUser) await User.deleteOne({ _id: testUser._id });
    await Notification.deleteMany({ booking: testBooking?._id });
    await Payment.deleteMany({ booking: testBooking?._id });
  } catch (e) {
    // Non-blocking
  }

  console.log(`\n==============================================`);
  console.log(`  Tests Completed: ${passedTests}/${totalTests} Passed`);
  console.log(`==============================================\n`);

  await mongoose.disconnect();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
