const axios = require('axios');

/**
 * Send WhatsApp notification using official WhatsApp Business API
 */
const sendWhatsApp = async ({ to, message }) => {
  if (!to) {
    return { success: false, error: 'Recipient phone number is missing' };
  }

  // Sanitize phone number (digits only)
  const cleanPhone = to.replace(/\D/g, '');

  const apiToken = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (apiToken && phoneId) {
    try {
      const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
      const response = await axios.post(
        url,
        {
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: message },
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true, messageId: response.data.messages?.[0]?.id, status: 'ACCEPTED' };
    } catch (err) {
      console.error('WhatsApp Business API error:', err.response?.data || err.message);
      return { success: false, error: err.message };
    }
  }

  console.warn(`[WHATSAPP NOTICE] WhatsApp Business API not configured. Notification to +${cleanPhone} recorded as FAILED.`);
  return {
    success: false,
    error: 'WhatsApp Business API not configured. Add WHATSAPP_API_TOKEN and WHATSAPP_PHONE_NUMBER_ID to backend/.env',
  };
};

/**
 * Formatted WhatsApp text messages
 */
const whatsappTemplates = {
  bookingConfirmation: ({ passengerName, safetyContactName, route, travelDate, departureTime, seat, bookingId }) => `
🛡️ *Travel Safety Notification*

Dear ${safetyContactName || 'Safety Contact'},

*${passengerName}* has booked a bus ticket on BusBook.

📍 *Route:* ${route}
📅 *Date:* ${travelDate}
⏰ *Departure:* ${departureTime}
💺 *Seat(s):* ${seat}
🎫 *Booking ID:* #${bookingId}
✅ *Status:* Confirmed

_This is an automated safety notification._
`.trim(),

  travelReminder: ({ passengerName, safetyContactName, route, departureTime, seat }) => `
⏰ *Travel Day Reminder*

Dear ${safetyContactName || 'Safety Contact'},

*${passengerName}* is scheduled to travel today.

📍 *Route:* ${route}
⏰ *Departure:* ${departureTime}
💺 *Seat(s):* ${seat}

_Safe travels from BusBook!_
`.trim(),

  passengerBoarded: ({ passengerName, safetyContactName, route, departureTime, seat, boardedAt }) => {
    const timeStr = boardedAt ? new Date(boardedAt).toLocaleTimeString() : departureTime;
    return `
✅ *Travel Safety Update: Boarded*

Dear ${safetyContactName || 'Safety Contact'},

*${passengerName}* has boarded the bus successfully at ${timeStr}.

📍 *Route:* ${route}
💺 *Seat(s):* ${seat}
Status: *BOARDED*

_This is an automated boarding verification update from BusBook._
`.trim();
  },

  busStarted: ({ passengerName, safetyContactName, busName, route, seat, departureTime, startedAt }) => {
    const timeStr = startedAt ? new Date(startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (departureTime || 'Just now');
    return `
🚍 *Bus Journey Started*

Dear ${safetyContactName || 'Guardian'},

The bus carrying *${passengerName}* has started its journey!

📍 *Route:* ${route}
🚌 *Bus:* ${busName || 'BusBook Express'}
⏰ *Departure Time:* ${timeStr}
💺 *Seat(s):* ${seat}
🟢 *Status:* In Transit / On the Way

_Live safety tracking is active on BusBook._
`.trim();
  },

  bookingCancelled: ({ passengerName, safetyContactName, route, travelDate, seat, bookingId, refundStatus }) => `
🚫 *Bus Booking Cancelled*

Dear ${safetyContactName || 'Passenger / Guardian'},

The bus booking #${bookingId} for *${passengerName}* on ${route} (${travelDate}) has been cancelled.

💺 *Seats Released:* ${seat}
💰 *Refund Status:* ${refundStatus || 'Processing'}

_BusBook Reservation System_
`.trim(),
};

module.exports = {
  sendWhatsApp,
  whatsappTemplates,
};
