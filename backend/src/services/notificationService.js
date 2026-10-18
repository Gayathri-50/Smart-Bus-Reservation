const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Bus = require('../models/Bus');
const User = require('../models/User');
const { sendEmail, templates: emailTemplates } = require('./emailService');

/**
 * Dispatch notification through real Email channel
 * For booking confirmation, sends to BOTH Customer and Guardian.
 */
const dispatchSafetyNotification = async ({ booking, type, payload }) => {
  if (!booking) return [];

  const results = [];

  // Ensure bus details are populated
  let bus = booking.bus;
  if (bus && typeof bus === 'object' && bus.busName) {
    // already populated
  } else if (booking.bus) {
    try {
      bus = await Bus.findById(booking.bus);
    } catch (e) {
      // ignore
    }
  }

  // Ensure user details are populated
  let user = booking.user;
  if (user && typeof user === 'object' && user.email) {
    // already populated
  } else if (booking.user) {
    try {
      user = await User.findById(booking.user);
    } catch (e) {
      // ignore
    }
  }

  const primaryPassenger = booking.passengerDetails?.[0] || {};
  const customerName = primaryPassenger.name || user?.name || 'Passenger';
  const customerEmail = primaryPassenger.email || user?.email || '';
  const customerPhone = primaryPassenger.phone || user?.phone || '';

  const safetyContact = booking.safetyContact || {};
  const guardianName = safetyContact.name || user?.guardian?.name || 'Parent / Guardian';
  const guardianEmail = safetyContact.email || user?.guardian?.email || '';
  const guardianPhone = safetyContact.phone || user?.guardian?.phone || '';
  const guardianRelationship = safetyContact.relationship || user?.guardian?.relationship || 'Parent / Guardian';
  const guardianPrefs = safetyContact.notificationPreferences || { email: true, whatsapp: true };

  const bookingIdDisplay = booking._id ? String(booking._id).slice(-8).toUpperCase() : 'PENDING';
  const seatString = (booking.seats || []).join(', ');

  const commonDetails = {
    passengerName: customerName,
    route: `${booking.from} → ${booking.to}`,
    from: booking.from,
    to: booking.to,
    busName: booking.busName || bus?.busName || 'BusBook Express',
    busNumber: bus?.busNumber || bus?.operator || 'BB-EXPRESS',
    travelDate: booking.travelDate,
    departureTime: booking.departureTime || bus?.departureTime || 'Scheduled Time',
    arrivalTime: booking.arrivalTime || bus?.arrivalTime || '',
    seat: seatString,
    boardingPoint: booking.from,
    bookingId: bookingIdDisplay,
    bookingStatus: booking.status || 'CONFIRMED',
    paymentStatus: booking.paymentStatus || 'SUCCESS',
    amountPaid: booking.totalAmount || 0,
    qrCode: booking.qrCode || '',
    ...payload,
  };

  // =========================================================================
  // 1. BOOKING CONFIRMATION: Send to BOTH Customer and Guardian
  // =========================================================================
  if (type === 'BOOKING_CONFIRMATION') {
    // A. Send to Customer
    if (customerEmail) {
      const alreadySentCustomer = await Notification.findOne({
        booking: booking._id,
        'recipient.email': customerEmail,
        type: 'BOOKING_CONFIRMATION',
        status: { $in: ['SENT', 'ACCEPTED', 'DELIVERED'] },
      });

      if (!alreadySentCustomer) {
        const customerMail = emailTemplates.bookingConfirmation({
          ...commonDetails,
          safetyContactName: customerName,
          recipientRole: 'Passenger',
        });

        const customerSendRes = await sendEmail({
          to: customerEmail,
          subject: customerMail.subject,
          text: customerMail.text,
          html: customerMail.html,
        });

        const customerNotif = await Notification.create({
          booking: booking._id,
          recipient: {
            name: customerName,
            email: customerEmail,
            phone: customerPhone,
            relationship: 'Self (Passenger)',
          },
          channel: 'EMAIL',
          type: 'BOOKING_CONFIRMATION',
          status: customerSendRes.success ? (customerSendRes.status || 'SENT') : 'FAILED',
          providerMessageId: customerSendRes.messageId || null,
          content: { subject: customerMail.subject, message: customerMail.text },
          sentAt: customerSendRes.success ? new Date() : null,
          error: customerSendRes.error || null,
        });

        results.push(customerNotif);
      }
    }

    // B. Send to Guardian
    if (guardianEmail && guardianEmail !== customerEmail && guardianPrefs.email !== false) {
      const alreadySentGuardian = await Notification.findOne({
        booking: booking._id,
        'recipient.email': guardianEmail,
        type: 'BOOKING_CONFIRMATION',
        status: { $in: ['SENT', 'ACCEPTED', 'DELIVERED'] },
      });

      if (!alreadySentGuardian) {
        const guardianMail = emailTemplates.bookingConfirmation({
          ...commonDetails,
          safetyContactName: guardianName,
          recipientRole: 'Guardian',
        });

        const guardianSendRes = await sendEmail({
          to: guardianEmail,
          subject: guardianMail.subject,
          text: guardianMail.text,
          html: guardianMail.html,
        });

        const guardianNotif = await Notification.create({
          booking: booking._id,
          recipient: {
            name: guardianName,
            email: guardianEmail,
            phone: guardianPhone,
            relationship: guardianRelationship,
          },
          channel: 'EMAIL',
          type: 'BOOKING_CONFIRMATION',
          status: guardianSendRes.success ? (guardianSendRes.status || 'SENT') : 'FAILED',
          providerMessageId: guardianSendRes.messageId || null,
          content: { subject: guardianMail.subject, message: guardianMail.text },
          sentAt: guardianSendRes.success ? new Date() : null,
          error: guardianSendRes.error || null,
        });

        results.push(guardianNotif);
      }
    }
  }

  // =========================================================================
  // 2. TRAVEL REMINDER & PASSENGER BOARDED: Dispatched to Guardian / Safety Contact
  // =========================================================================
  if (type === 'TRAVEL_REMINDER' || type === 'PASSENGER_BOARDED') {
    if (guardianEmail && guardianPrefs.email !== false) {
      let emailContent;
      if (type === 'TRAVEL_REMINDER') {
        emailContent = emailTemplates.travelReminder({
          ...commonDetails,
          safetyContactName: guardianName,
        });
      } else if (type === 'PASSENGER_BOARDED') {
        emailContent = emailTemplates.passengerBoarded({
          ...commonDetails,
          safetyContactName: guardianName,
        });
      }

      if (emailContent) {
        const emailResult = await sendEmail({
          to: guardianEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
        });

        const notifDoc = await Notification.create({
          booking: booking._id,
          recipient: {
            name: guardianName,
            email: guardianEmail,
            phone: guardianPhone,
            relationship: guardianRelationship,
          },
          channel: 'EMAIL',
          type,
          status: emailResult.success ? (emailResult.status || 'SENT') : 'FAILED',
          providerMessageId: emailResult.messageId || null,
          content: { subject: emailContent.subject, message: emailContent.text },
          sentAt: emailResult.success ? new Date() : null,
          error: emailResult.error || null,
        });

        results.push(notifDoc);
      }
    }
  }

  // =========================================================================
  // 3. BOOKING CANCELLED: Dispatched to Passenger & Guardian
  // =========================================================================
  if (type === 'BOOKING_CANCELLED') {
    const cancelPayload = {
      ...commonDetails,
      refundStatus: payload?.refundStatus || 'Processing',
      amount: payload?.amount || booking.totalAmount || 0,
    };

    if (customerEmail) {
      const customerMail = emailTemplates.bookingCancelled({
        ...cancelPayload,
        safetyContactName: customerName,
        recipientRole: 'Passenger',
      });

      const customerSendRes = await sendEmail({
        to: customerEmail,
        subject: customerMail.subject,
        text: customerMail.text,
        html: customerMail.html,
      });

      const customerNotif = await Notification.create({
        booking: booking._id,
        recipient: {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          relationship: 'Self (Passenger)',
        },
        channel: 'EMAIL',
        type: 'BOOKING_CANCELLED',
        status: customerSendRes.success ? (customerSendRes.status || 'SENT') : 'FAILED',
        providerMessageId: customerSendRes.messageId || null,
        content: { subject: customerMail.subject, message: customerMail.text },
        sentAt: customerSendRes.success ? new Date() : null,
        error: customerSendRes.error || null,
      });

      results.push(customerNotif);
    }

    if (guardianEmail && guardianEmail !== customerEmail && guardianPrefs.email !== false) {
      const guardianMail = emailTemplates.bookingCancelled({
        ...cancelPayload,
        safetyContactName: guardianName,
        recipientRole: 'Guardian',
      });

      const guardianSendRes = await sendEmail({
        to: guardianEmail,
        subject: guardianMail.subject,
        text: guardianMail.text,
        html: guardianMail.html,
      });

      const guardianNotif = await Notification.create({
        booking: booking._id,
        recipient: {
          name: guardianName,
          email: guardianEmail,
          phone: guardianPhone,
          relationship: guardianRelationship,
        },
        channel: 'EMAIL',
        type: 'BOOKING_CANCELLED',
        status: guardianSendRes.success ? (guardianSendRes.status || 'SENT') : 'FAILED',
        providerMessageId: guardianSendRes.messageId || null,
        content: { subject: guardianMail.subject, message: guardianMail.text },
        sentAt: guardianSendRes.success ? new Date() : null,
        error: guardianSendRes.error || null,
      });

      results.push(guardianNotif);
    }
  }

  // Record Audit Log entry
  try {
    await AuditLog.create({
      action: 'SAFETY_NOTIFICATION_SENT',
      performedBy: { name: 'Notification Service', role: 'SYSTEM' },
      targetType: 'NOTIFICATION',
      targetId: String(booking._id),
      details: {
        type,
        customerEmail,
        guardianEmail,
        channelsDispatched: results.map((r) => r.channel),
      },
    });
  } catch (err) {
    // Non-blocking
  }

  return results;
};

const Booking = require('../models/Booking');

const dispatchScheduledTravelReminders = async () => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const upcomingBookings = await Booking.find({
    travelDate: todayStr,
    status: { $in: ['CONFIRMED', 'confirmed'] },
    boardingStatus: { $ne: 'BOARDED' },
  }).populate('user', 'name email phone');

  const dispatched = [];
  for (const b of upcomingBookings) {
    const alreadySent = await Notification.findOne({
      booking: b._id,
      type: 'TRAVEL_REMINDER',
      status: 'SENT',
    });

    if (!alreadySent) {
      await dispatchSafetyNotification({ booking: b, type: 'TRAVEL_REMINDER' });
      dispatched.push(b._id);
    }
  }

  return { totalChecked: upcomingBookings.length, dispatchedCount: dispatched.length };
};

/**
 * Dispatch "Bus Started" journey alerts to all guardians of confirmed passengers on a bus
 */
const sendBusStartedNotifications = async ({ busId, startedAt, currentLocation } = {}) => {
  const bus = await Bus.findById(busId);
  if (!bus) {
    throw new Error('Bus not found');
  }

  // Find all active/confirmed bookings for this bus
  const bookings = await Booking.find({
    bus: bus._id,
    status: { $in: ['CONFIRMED', 'confirmed', 'BOARDED', 'CHECKED_IN'] },
  }).populate('user', 'name email phone guardian');

  const results = [];

  for (const booking of bookings) {
    const contact = booking.safetyContact || {};
    const guardianEmail = contact.email || booking.user?.guardian?.email;
    const guardianPhone = contact.phone || booking.user?.guardian?.phone;
    const guardianName = contact.name || booking.user?.guardian?.name || 'Guardian';
    const guardianPrefs = contact.notificationPreferences || { email: true, whatsapp: true };
    const passengerName = booking.passengerDetails?.[0]?.name || booking.user?.name || 'Passenger';
    const seatString = (booking.seats || []).join(', ');

    const payload = {
      passengerName,
      safetyContactName: guardianName,
      busName: bus.busName,
      busNumber: bus.operator || 'BB-EXPRESS',
      route: `${bus.from} → ${bus.to}`,
      from: bus.from,
      to: bus.to,
      departureTime: bus.departureTime,
      arrivalTime: bus.arrivalTime,
      seat: seatString,
      startedAt: startedAt || new Date(),
      currentLocation: currentLocation || bus.from,
    };

    // 1. Email to Guardian
    if (guardianEmail && guardianPrefs.email !== false) {
      const alreadySent = await Notification.findOne({
        booking: booking._id,
        'recipient.email': guardianEmail,
        type: 'BUS_STARTED',
        status: 'SENT',
      });

      if (!alreadySent) {
        const mailContent = emailTemplates.busStarted(payload);
        const sendRes = await sendEmail({
          to: guardianEmail,
          subject: mailContent.subject,
          text: mailContent.text,
          html: mailContent.html,
        });

        const notifDoc = await Notification.create({
          booking: booking._id,
          recipient: {
            name: guardianName,
            email: guardianEmail,
            phone: guardianPhone,
            relationship: contact.relationship || 'Guardian',
          },
          channel: 'EMAIL',
          type: 'BUS_STARTED',
          status: sendRes.success ? 'SENT' : 'FAILED',
          content: { subject: mailContent.subject, message: mailContent.text },
          sentAt: sendRes.success ? new Date() : null,
          error: sendRes.error || null,
        });

        results.push(notifDoc);
      }
    }
  }

  // Audit log
  try {
    await AuditLog.create({
      action: 'BUS_STARTED_ALERTS_DISPATCHED',
      performedBy: { name: 'Operations Staff', role: 'STAFF' },
      targetType: 'BUS',
      targetId: String(bus._id),
      details: {
        busName: bus.busName,
        route: `${bus.from} -> ${bus.to}`,
        recipientsCount: results.length,
      },
    });
  } catch (e) {
    // non-blocking
  }

  return { totalBookings: bookings.length, notificationsDispatched: results.length, results };
};

module.exports = {
  dispatchSafetyNotification,
  sendBookingConfirmation: (booking) =>
    dispatchSafetyNotification({ booking, type: 'BOOKING_CONFIRMATION' }),
  sendTravelReminder: (booking) =>
    dispatchSafetyNotification({ booking, type: 'TRAVEL_REMINDER' }),
  sendPassengerBoarded: (booking, { boardedAt } = {}) =>
    dispatchSafetyNotification({
      booking,
      type: 'PASSENGER_BOARDED',
      payload: { boardedAt: boardedAt || new Date() },
    }),
  sendBookingCancelled: (booking, payload = {}) =>
    dispatchSafetyNotification({
      booking,
      type: 'BOOKING_CANCELLED',
      payload,
    }),
  sendBusStartedNotifications,
  dispatchScheduledTravelReminders,
};
