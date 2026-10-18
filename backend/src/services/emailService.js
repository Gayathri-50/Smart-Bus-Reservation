const nodemailer = require('nodemailer');

// Initialize transporter from environment variables
const createTransporter = () => {
  const host = process.env.SMTP_HOST?.trim();
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD?.trim();

  if (user && pass) {
    // If explicitly gmail host or gmail address
    if ((host && host.toLowerCase().includes('gmail')) || user.toLowerCase().endsWith('@gmail.com')) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
    if (host) {
      return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: {
          rejectUnauthorized: false,
        },
      });
    }
  }

  return null;
};

const getTransporter = () => createTransporter();

/**
 * Verify SMTP connection without sending email
 */
const verifyTransporter = async () => {
  const transporter = getTransporter();
  const host = process.env.SMTP_HOST?.trim() || (process.env.SMTP_USER?.includes('@gmail.com') ? 'service: gmail' : '');
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const rawUser = process.env.SMTP_USER?.trim() || '';
  const maskedUser = rawUser.includes('@')
    ? `${rawUser.split('@')[0].slice(0, 2)}***@${rawUser.split('@')[1]}`
    : rawUser ? `${rawUser.slice(0, 3)}***` : 'Not configured';

  if (!transporter) {
    return {
      configured: false,
      verified: false,
      host: host || 'Not configured',
      port,
      user: maskedUser,
      message: 'SMTP credentials missing. Please set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in backend/.env',
    };
  }
  try {
    await transporter.verify();
    return {
      configured: true,
      verified: true,
      host: host || 'Configured',
      port,
      user: maskedUser,
      message: 'SMTP connection verified successfully.',
    };
  } catch (err) {
    return {
      configured: true,
      verified: false,
      host: host || 'Configured',
      port,
      user: maskedUser,
      error: err.message,
      message: `SMTP connection verification failed: ${err.message}`,
    };
  }
};

/**
 * Send a dedicated test email (development / diagnostics)
 */
const sendTestEmail = async (targetEmail) => {
  const subject = 'BusBook — SMTP Test Email';
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b0f19; color: #f8fafc; border-radius: 12px; border: 1px solid #1f2937; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #6366f1; margin-top: 0;">🚌 BusBook SMTP Test</h2>
      <p style="color: #e2e8f0; font-size: 15px;">Your Nodemailer SMTP server connection is active and operational!</p>
      <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; padding: 12px; border-radius: 8px; color: #34d399; margin: 16px 0;">
        ✓ Real email delivery verified at ${new Date().toLocaleString()}
      </div>
      <p style="color: #94a3b8; font-size: 12px;">This is an isolated test email sent by authorized staff.</p>
    </div>
  `;
  const text = `BusBook SMTP Test\n\nYour Nodemailer SMTP connection is active and operational.\nVerified at: ${new Date().toISOString()}`;

  return await sendEmail({ to: targetEmail, subject, html, text });
};

/**
 * Send an email notification to safety contact or customer
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to) {
    return { success: false, error: 'Recipient email address is missing' };
  }

  try {
    const transporter = getTransporter();
    if (transporter) {
      const fromAddr = process.env.SMTP_FROM || process.env.EMAIL_FROM || (process.env.SMTP_USER ? `"BusBook Reservations" <${process.env.SMTP_USER}>` : `"BusBook Safety" <no-reply@busbook.com>`);
      const info = await transporter.sendMail({
        from: fromAddr,
        to,
        subject,
        text,
        html,
      });
      return { success: true, messageId: info.messageId, status: 'ACCEPTED' };
    }

    console.warn(`[EMAIL NOTICE] SMTP not configured. Notification to ${to} (${subject}) recorded as FAILED.`);
    return {
      success: false,
      error: 'SMTP provider not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD in backend/.env',
    };
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return { success: false, error: err.message };
  }
};

/**
 * Email Templates for Safety Notifications
 */
const templates = {
  bookingConfirmation: ({
    passengerName,
    safetyContactName,
    recipientRole = 'Passenger', // 'Passenger' or 'Guardian'
    route,
    from,
    to,
    busNumber,
    busName,
    travelDate,
    departureTime,
    arrivalTime,
    seat,
    boardingPoint,
    bookingId,
    bookingStatus = 'CONFIRMED',
    paymentStatus = 'SUCCESS',
    amountPaid = 0,
    qrCode,
  }) => {
    const subject = `Bus Booking Confirmed — [${bookingId}]`;
    const text = `
Bus Booking Confirmed — [${bookingId}]

Dear ${safetyContactName || passengerName}${recipientRole === 'Guardian' ? ' (Guardian)' : ''},

This email confirms the bus booking on BusBook.

Booking ID: #${bookingId}
Passenger: ${passengerName}
Bus: ${busName || 'BusBook Express'} (${busNumber || 'KA-01-BB-1001'})
Route: ${route || `${from} → ${to}`}
Travel Date: ${travelDate}
Departure Time: ${departureTime}
${arrivalTime ? `Arrival Time: ${arrivalTime}\n` : ''}Seat(s): ${seat}
${boardingPoint ? `Boarding Point: ${boardingPoint}\n` : ''}Total Paid: ₹${amountPaid}
Payment Status: ${paymentStatus}
Booking Status: ${bookingStatus}

Please carry your digital QR ticket or confirmation at the time of boarding.

Thank you for choosing BusBook!
`.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; margin: 0; padding: 24px; color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.6);">
    <!-- Brand Banner -->
    <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">🚌 BusBook</h1>
      <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 13px;">Smart Bus Reservation Confirmation</p>
    </div>

    <div style="padding: 24px;">
      <!-- Status Badge -->
      <div style="background-color: #064e3b; border: 1px solid #059669; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; text-align: center;">
        <span style="color: #34d399; font-size: 17px; font-weight: 700;">✓ Booking Confirmed &amp; Payment Verified</span>
        <p style="color: #a7f3d0; margin: 4px 0 0 0; font-size: 13px;">Booking Reference: <strong>#${bookingId}</strong></p>
      </div>

      <p style="font-size: 15px; color: #cbd5e1; margin-top: 0;">
        Dear <strong>${safetyContactName || passengerName}</strong>${recipientRole === 'Guardian' ? ' <span style="color: #38bdf8; font-size: 12px;">(Guardian Notification)</span>' : ''},
      </p>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
        ${recipientRole === 'Guardian'
          ? `This is a travel notification confirming that <strong>${passengerName}</strong> has booked a verified bus trip.`
          : `Thank you for booking with BusBook! Your reservation for <strong>${passengerName}</strong> is confirmed and secured.`
        }
      </p>

      <!-- Journey Card -->
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; color: #e2e8f0;">
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Route</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #818cf8;">${route || `${from} → ${to}`}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Bus Details</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right;">${busName || 'BusBook Express'} (${busNumber || 'BB-EXPRESS'})</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Travel Date</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right;">${travelDate}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Departure Time</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #34d399;">${departureTime}</td>
        </tr>
        ${arrivalTime ? `
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Estimated Arrival</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right;">${arrivalTime}</td>
        </tr>` : ''}
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Selected Seat(s)</td>
          <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #fbbf24;">${seat}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Amount Paid</td>
          <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #34d399;">₹${amountPaid}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Payment Status</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #34d399;">${paymentStatus}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #94a3b8;">Boarding Status</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right;">Confirmed (Pending Boarding)</td>
        </tr>
      </table>

      <!-- QR Ticket -->
      <div style="background-color: #0b0f19; border-radius: 8px; padding: 18px; margin: 20px 0; text-align: center; border: 1px dashed #374151;">
        <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 13px;">Show QR Ticket to the Bus Operator at boarding:</p>
        <div style="display: inline-block; background: #ffffff; padding: 10px; border-radius: 8px;">
          ${qrCode ? `<img src="${qrCode}" alt="QR Ticket" width="130" height="130" style="display: block;" />` : `<span style="color: #111827; font-family: monospace; font-size: 13px; font-weight: bold;">TICKET: #${bookingId}</span>`}
        </div>
        <p style="margin: 10px 0 0 0; color: #64748b; font-size: 11px;">Verification Token: ${bookingId}</p>
      </div>

      <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 12px; color: #64748b;">
        <p style="margin: 0;">This is an automated booking confirmation receipt from BusBook.</p>
        <p style="margin: 4px 0 0 0;">Safe travels! For emergency assistance, please contact your designated trip manager.</p>
      </div>
    </div>
  </div>
</body>
</html>
`.trim();

    return { subject, text, html };
  },

  travelReminder: ({ passengerName, safetyContactName, route, travelDate, departureTime, seat }) => {
    const text = `
Travel Reminder

Dear ${safetyContactName || 'Safety Contact'},

${passengerName} is scheduled to travel today.

Route: ${route}
Travel Date: ${travelDate}
Departure: ${departureTime}
Seat(s): ${seat}

This is an automated safety notification.
`;
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
  <h2 style="color: #d97706;">⏰ Travel Day Reminder</h2>
  <p>Dear <strong>${safetyContactName || 'Safety Contact'}</strong>,</p>
  <p><strong>${passengerName}</strong> is scheduled to depart today.</p>
  <div style="background-color: #fefce8; padding: 15px; border-radius: 6px; margin: 15px 0;">
    <p style="margin: 4px 0;"><strong>Route:</strong> ${route}</p>
    <p style="margin: 4px 0;"><strong>Departure:</strong> ${departureTime}</p>
    <p style="margin: 4px 0;"><strong>Seat(s):</strong> ${seat}</p>
  </div>
  <p style="color: #64748b; font-size: 12px;">This is an automated safety reminder.</p>
</div>
`;
    return { subject: `Travel Reminder: ${passengerName} departs today`, text, html };
  },

  passengerBoarded: ({ passengerName, safetyContactName, route, departureTime, seat, boardedAt }) => {
    const timeStr = boardedAt ? new Date(boardedAt).toLocaleTimeString() : departureTime;
    const text = `
Travel Safety Update

Dear ${safetyContactName || 'Safety Contact'},

${passengerName} has boarded the bus successfully at ${timeStr}.

Route: ${route}
Scheduled Departure: ${departureTime}
Seat(s): ${seat}

This is an automated safety update.
`;
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
  <h2 style="color: #059669;">✅ Passenger Boarded Safely</h2>
  <p>Dear <strong>${safetyContactName || 'Safety Contact'}</strong>,</p>
  <p><strong>${passengerName}</strong> has boarded the bus successfully (verified via QR ticket scan at ${timeStr}).</p>
  <div style="background-color: #f0fdf4; padding: 15px; border-radius: 6px; margin: 15px 0;">
    <p style="margin: 4px 0;"><strong>Route:</strong> ${route}</p>
    <p style="margin: 4px 0;"><strong>Seat(s):</strong> ${seat}</p>
    <p style="margin: 4px 0;"><strong>Status:</strong> Boarded</p>
  </div>
  <p style="color: #64748b; font-size: 12px;">This is an automated boarding verification update.</p>
</div>
`;
    return { subject: `Safety Update: ${passengerName} has boarded the bus`, text, html };
  },

  busStarted: ({
    passengerName,
    safetyContactName,
    busName,
    busNumber,
    route,
    from,
    to,
    departureTime,
    arrivalTime,
    seat,
    startedAt,
    currentLocation,
  }) => {
    const timeFormatted = startedAt
      ? new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : (departureTime || 'Just now');
    const subject = `Bus Started — Journey Status Update for ${passengerName}`;
    const text = `
Bus Journey Started — Safety Status Alert

Dear ${safetyContactName || 'Guardian'},

The bus carrying ${passengerName} has officially started its journey!

Bus: ${busName || 'BusBook Express'} (${busNumber || 'BB-EXPRESS'})
Route: ${route || `${from} → ${to}`}
Departure Time: ${timeFormatted}
${arrivalTime ? `Estimated Arrival: ${arrivalTime}\n` : ''}Passenger: ${passengerName}
Seat(s): ${seat}
Current Status: In Transit / On the Way ${currentLocation ? `(Near ${currentLocation})` : ''}

Live safety monitoring is active. You will receive further updates upon boarding and arrival.

BusBook Safety Services
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090d16; margin: 0; padding: 24px; color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.6);">
    <div style="background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%); padding: 22px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">🚍 Bus Journey Started</h1>
      <p style="color: #e0f2fe; margin: 6px 0 0 0; font-size: 13px;">Live Guardian Safety Update</p>
    </div>

    <div style="padding: 24px;">
      <div style="background-color: #082f49; border: 1px solid #0284c7; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; text-align: center;">
        <span style="color: #38bdf8; font-size: 16px; font-weight: 700;">🟢 Trip is Now In Transit</span>
        <p style="color: #bae6fd; margin: 4px 0 0 0; font-size: 12px;">Departed at <strong>${timeFormatted}</strong></p>
      </div>

      <p style="font-size: 15px; color: #cbd5e1; margin-top: 0;">
        Dear <strong>${safetyContactName || 'Guardian'}</strong>,
      </p>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">
        This automated safety notification is to inform you that the bus carrying <strong>${passengerName}</strong> has departed from <strong>${from}</strong> and is currently on its journey towards <strong>${to}</strong>.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; color: #e2e8f0;">
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Passenger</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #f8fafc;">${passengerName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Route</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #38bdf8;">${route || `${from} → ${to}`}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Bus Details</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right;">${busName || 'BusBook Express'} (${busNumber || 'BB-EXPRESS'})</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Departure Time</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right; color: #34d399;">${timeFormatted}</td>
        </tr>
        ${arrivalTime ? `
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Est. Arrival</td>
          <td style="padding: 10px 0; font-weight: 600; text-align: right;">${arrivalTime}</td>
        </tr>` : ''}
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8;">Seat(s)</td>
          <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #fbbf24;">${seat}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #94a3b8;">Trip Status</td>
          <td style="padding: 10px 0; font-weight: 700; text-align: right; color: #38bdf8;">In Transit / On the Way</td>
        </tr>
      </table>

      <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px; text-align: center; font-size: 12px; color: #64748b;">
        <p style="margin: 0;">This is an automated safety alert from BusBook Guardian Tracking.</p>
        <p style="margin: 4px 0 0 0;">Passenger safety is our top priority.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { subject, text, html };
  },

  bookingCancelled: ({
    passengerName,
    safetyContactName,
    recipientRole = 'Passenger',
    route,
    busName,
    busNumber,
    travelDate,
    seat,
    bookingId,
    refundStatus = 'Initiated',
    amount = 0,
  }) => {
    const subject = `Booking Cancellation Notice — [${bookingId}]`;
    const text = `
Booking Cancellation Notice — [${bookingId}]

Dear ${safetyContactName || passengerName}${recipientRole === 'Guardian' ? ' (Guardian)' : ''},

The bus reservation with Reference #${bookingId} has been successfully cancelled.

Passenger: ${passengerName}
Bus: ${busName || 'BusBook Express'} (${busNumber || 'BB-EXPRESS'})
Route: ${route}
Travel Date: ${travelDate}
Seat(s) Released: ${seat}
Amount: ₹${amount}
Refund Status: ${refundStatus}

If you have questions, please contact our support team.

BusBook Support Team
    `.trim();

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #090d16; margin: 0; padding: 24px; color: #f8fafc;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111827; border-radius: 12px; border: 1px solid #1f2937; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 22px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Booking Cancelled</h1>
      <p style="color: #fee2e2; margin: 6px 0 0 0; font-size: 13px;">Reservation Reference #${bookingId}</p>
    </div>
    <div style="padding: 24px;">
      <p style="font-size: 15px; color: #cbd5e1; margin-top: 0;">Dear <strong>${safetyContactName || passengerName}</strong>,</p>
      <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">This notification confirms that the bus booking for <strong>${passengerName}</strong> has been cancelled and seat inventory has been released.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; color: #e2e8f0;">
        <tr style="border-bottom: 1px solid #1f2937;"><td style="padding: 8px 0; color: #94a3b8;">Route</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${route}</td></tr>
        <tr style="border-bottom: 1px solid #1f2937;"><td style="padding: 8px 0; color: #94a3b8;">Travel Date</td><td style="padding: 8px 0; font-weight: 600; text-align: right;">${travelDate}</td></tr>
        <tr style="border-bottom: 1px solid #1f2937;"><td style="padding: 8px 0; color: #94a3b8;">Seats Released</td><td style="padding: 8px 0; font-weight: 600; text-align: right; color: #f87171;">${seat}</td></tr>
        <tr style="border-bottom: 1px solid #1f2937;"><td style="padding: 8px 0; color: #94a3b8;">Refund Amount</td><td style="padding: 8px 0; font-weight: 600; text-align: right; color: #34d399;">₹${amount}</td></tr>
        <tr><td style="padding: 8px 0; color: #94a3b8;">Refund Status</td><td style="padding: 8px 0; font-weight: 600; text-align: right; color: #38bdf8;">${refundStatus}</td></tr>
      </table>
      <div style="border-top: 1px solid #1f2937; padding-top: 14px; text-align: center; font-size: 12px; color: #64748b;">
        <p style="margin: 0;">Automated notification from BusBook Reservation System.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();

    return { subject, text, html };
  },
};

module.exports = {
  sendEmail,
  verifyTransporter,
  sendTestEmail,
  templates,
};
