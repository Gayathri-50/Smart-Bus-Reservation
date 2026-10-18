const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
      default: null,
      index: true,
    },
    recipient: {
      name: { type: String, default: 'Safety Contact' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      relationship: { type: String, default: 'Contact' },
    },
    channel: {
      type: String,
      enum: ['EMAIL', 'WHATSAPP'],
      required: true,
    },
    type: {
      type: String,
      enum: [
        'BOOKING_CONFIRMATION',
        'TRAVEL_REMINDER',
        'PASSENGER_BOARDED',
        'BUS_STARTED',
        'BOOKING_CANCELLED',
        'SCHEDULE_DELAYED',
        'STATUS_UPDATE',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'SENT', 'DELIVERED', 'FAILED'],
      default: 'PENDING',
    },
    providerMessageId: {
      type: String,
      default: null,
    },
    content: {
      subject: String,
      message: String,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    attemptCount: {
      type: Number,
      default: 1,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
