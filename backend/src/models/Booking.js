const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
    },
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      default: null,
      index: true,
    },
    busName: String,
    from: String,
    to: String,
    travelDate: {
      type: String,
      required: true,
      index: true,
    },
    departureTime: String,
    arrivalTime: String,
    seats: {
      type: [Number],
      required: true,
    },
    passengerCount: Number,
    passengerDetails: [
      {
        name: {
          type: String,
          required: true,
        },
        email: {
          type: String,
          required: true,
        },
        phone: {
          type: String,
          required: true,
        },
        age: Number,
        gender: String,
      },
    ],
    safetyContact: {
      name: {
        type: String,
        required: true,
        default: 'Parent / Guardian',
      },
      relationship: {
        type: String,
        default: 'Family',
      },
      phone: {
        type: String,
        required: true,
        default: '',
      },
      email: {
        type: String,
        default: '',
      },
      notificationPreferences: {
        email: {
          type: Boolean,
          default: true,
        },
        whatsapp: {
          type: Boolean,
          default: true,
        },
      },
    },
    fare: Number,
    totalAmount: {
      type: Number,
      required: true,
    },
    farePerSeat: Number,
    status: {
      type: String,
      enum: [
        'PENDING_PAYMENT',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'CONFIRMED',
        'CHECKED_IN',
        'BOARDED',
        'COMPLETED',
        'CANCELLED',
        'NO_SHOW',
        'pending',
        'confirmed',
        'completed',
        'cancelled',
      ],
      default: 'PENDING_PAYMENT',
    },
    boardingStatus: {
      type: String,
      enum: ['NOT_BOARDED', 'BOARDED', 'NO_SHOW'],
      default: 'NOT_BOARDED',
    },
    boardedAt: {
      type: Date,
      default: null,
    },
    boardedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    paymentMode: {
      type: String,
      enum: ['Card', 'UPI', 'Wallet', 'Cash'],
      default: 'UPI',
    },
    paymentStatus: {
      type: String,
      enum: [
        'PENDING',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
        'SUCCESS',
        'FAILED',
        'REFUND_PENDING',
        'REFUNDED',
        'pending',
        'completed',
        'failed',
      ],
      default: 'PENDING',
    },
    razorpayOrderId: {
      type: String,
      default: null,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    ticketToken: {
      type: String,
      default: null,
    },
    qrCode: {
      type: String,
      default: null,
    },
    bookingType: {
      type: String,
      enum: ['NORMAL', 'EMERGENCY', 'normal', 'emergency'],
      default: 'NORMAL',
    },
    emergencyReason: {
      type: String,
      enum: ['Festival', 'Medical Emergency', 'Family Emergency', 'Urgent Work', 'Other', null],
      default: null,
    },
    priorityLevel: {
      type: String,
      enum: ['normal', 'high', 'critical'],
      default: 'normal',
    },
    priorityFee: {
      type: Number,
      default: 0,
    },
    cancellationDate: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Booking', bookingSchema);