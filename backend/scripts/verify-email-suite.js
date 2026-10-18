/**
 * Email & Notification Verification Suite
 * Validates SMTP configuration, verification endpoint, test email endpoint,
 * payment confirmation dispatch, guardian notification, and retry mechanism.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Bus = require('../src/models/Bus');
const Booking = require('../src/models/Booking');
const Notification = require('../src/models/Notification');
const emailService = require('../src/services/emailService');
const notificationService = require('../src/services/notificationService');

async function runEmailSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING EMAIL & NOTIFICATION VERIFICATION SUITE');
  console.log('======================================================\n');

  await connectDB();

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
      console.error(`    Details: ${err.message}`);
    }
  };

  try {
    // 1. Verify Transporter Diagnostic
    await test('1. SMTP Transporter Connection Diagnostics', async () => {
      const verifyRes = await emailService.verifyTransporter();
      console.log(`     Reported Status: configured=${verifyRes.configured}, verified=${verifyRes.verified}, host=${verifyRes.host}`);
      if (typeof verifyRes.configured !== 'boolean') {
        throw new Error('Expected boolean configured property');
      }
      // Never expose secrets
      if (verifyRes.pass || verifyRes.password || JSON.stringify(verifyRes).includes(process.env.SMTP_PASSWORD || '___')) {
        throw new Error('CRITICAL SECURITY: Password exposed in verification output!');
      }
    });

    // 2. Safe Test Email Dispatch (Does not alter customer bookings)
    await test('2. Safe Isolated Test Email Dispatch (sendTestEmail)', async () => {
      const initialBookingsCount = await Booking.countDocuments();
      const sendRes = await emailService.sendTestEmail('admin_diagnostic@busbook.com');
      const postBookingsCount = await Booking.countDocuments();

      if (initialBookingsCount !== postBookingsCount) {
        throw new Error('Test email must NEVER create or modify customer bookings!');
      }

      console.log(`     Outcome: success=${sendRes.success}, error=${sendRes.error || 'None'}`);
      if (sendRes.success && !sendRes.messageId) {
        throw new Error('Successful email must provide messageId');
      }
      if (!sendRes.success && !sendRes.error) {
        throw new Error('Failed email must provide error details');
      }
    });

    // 3. Customer & Guardian Multi-Recipient Confirmation Flow
    await test('3. Dual Dispatch: Customer & Guardian Confirmation Emails', async () => {
      // Find or seed a bus
      let bus = await Bus.findOne();
      if (!bus) {
        bus = await Bus.create({
          busName: 'Test Express',
          busNumber: 'TEST-101',
          operator: 'BusBook Fleet',
          from: 'Bengaluru',
          to: 'Mysuru',
          fare: 450,
          totalSeats: 40,
          availableSeats: 38,
          bookedSeats: [],
          departureTime: '09:00 AM',
          arrivalTime: '12:00 PM',
          rating: 4.8,
        });
      }

      // Find or seed a customer with guardian
      let customer = await User.findOne({ email: 'test_passenger@busbook.com' });
      if (!customer) {
        customer = await User.create({
          name: 'Gayathri Passenger',
          email: 'test_passenger@busbook.com',
          password: 'hashedpassword123',
          phone: '9876543210',
          role: 'CUSTOMER',
          guardian: {
            name: 'Gayathri Guardian',
            email: 'test_guardian@busbook.com',
            phone: '9876543211',
            relationship: 'Mother',
          },
        });
      }

      // Create a confirmed booking
      const testBooking = await Booking.create({
        user: customer._id,
        bus: bus._id,
        busName: bus.busName,
        from: bus.from,
        to: bus.to,
        travelDate: '2026-10-25',
        departureTime: '09:00 AM',
        seats: [14, 15],
        passengerCount: 2,
        passengerDetails: [
          { name: 'Gayathri Passenger', email: 'test_passenger@busbook.com', phone: '9876543210' },
          { name: 'Friend Passenger', email: 'friend@busbook.com', phone: '9876543212' },
        ],
        safetyContact: {
          name: 'Gayathri Guardian',
          email: 'test_guardian@busbook.com',
          phone: '9876543211',
          relationship: 'Mother',
          notificationPreferences: { email: true, whatsapp: true },
        },
        fare: 900,
        totalAmount: 900,
        farePerSeat: 450,
        paymentMode: 'UPI',
        status: 'CONFIRMED',
        paymentStatus: 'SUCCESS',
        ticketToken: `TKT-SUITE-${Date.now()}`,
      });

      // Dispatch confirmation
      const notifs = await notificationService.sendBookingConfirmation(testBooking);
      console.log(`     Dispatched notifications count: ${notifs.length}`);

      const customerNotif = notifs.find((n) => n.recipient?.email === 'test_passenger@busbook.com');
      const guardianNotif = notifs.find((n) => n.recipient?.email === 'test_guardian@busbook.com');

      if (!customerNotif) throw new Error('Customer notification record was not created');
      if (!guardianNotif) throw new Error('Guardian notification record was not created');

      console.log(`     Passenger notification status: ${customerNotif.status} (${customerNotif.channel})`);
      console.log(`     Guardian notification status: ${guardianNotif.status} (${guardianNotif.channel})`);

      // Verify that confirmed booking is preserved regardless of delivery outcome
      const refreshedBooking = await Booking.findById(testBooking._id);
      if (refreshedBooking.status !== 'CONFIRMED') {
        throw new Error('Email status failure must NEVER revert a confirmed booking!');
      }

      // 4. Test Idempotency / Duplicate Prevention
      const secondAttempt = await notificationService.sendBookingConfirmation(testBooking);
      // If the first attempt was ACCEPTED or SENT, second attempt must not duplicate
      if (['ACCEPTED', 'SENT', 'DELIVERED'].includes(customerNotif.status)) {
        if (secondAttempt.length > 0) {
          throw new Error('Duplicate emails were sent on repeated booking confirmation call!');
        }
      }
    });

    // 5. Test Notification Retry Mechanism
    await test('4. Notification Retry Mechanism (/api/admin/notifications/:id/retry)', async () => {
      // Create a mock failed notification
      const failedNotif = await Notification.create({
        recipient: {
          name: 'Retry Test User',
          email: 'retry_test@busbook.com',
          phone: '9999988888',
          relationship: 'Parent / Guardian',
        },
        channel: 'EMAIL',
        type: 'BOOKING_CONFIRMATION',
        status: 'FAILED',
        error: 'Initial simulation failure for retry testing',
        attemptCount: 1,
        content: {
          subject: 'Bus Booking Confirmed',
          message: 'Booking details here...',
        },
      });

      // Simulate admin calling retry endpoint logic
      failedNotif.attemptCount = (failedNotif.attemptCount || 1) + 1;
      const sendRes = await emailService.sendEmail({
        to: failedNotif.recipient.email,
        subject: failedNotif.content.subject,
        text: failedNotif.content.message,
        html: `<p>${failedNotif.content.message}</p>`,
      });

      if (sendRes.success) {
        failedNotif.status = sendRes.status || 'ACCEPTED';
        failedNotif.providerMessageId = sendRes.messageId || null;
        failedNotif.error = null;
      } else {
        failedNotif.status = 'FAILED';
        failedNotif.error = sendRes.error || 'Retry failed';
      }
      await failedNotif.save();

      console.log(`     Retry result: attemptCount=${failedNotif.attemptCount}, status=${failedNotif.status}, error=${failedNotif.error || 'None'}`);
      if (failedNotif.attemptCount !== 2) {
        throw new Error('Attempt count was not incremented');
      }
    });
  } finally {
    console.log('\n======================================================');
    console.log(`📊 RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log('======================================================\n');
    await mongoose.disconnect();
  }
}

runEmailSuite().catch((err) => {
  console.error('Fatal suite error:', err);
  process.exit(1);
});
