const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    bus: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
    },
    busName: {
      type: String,
      default: '',
    },
    from: {
      type: String,
      required: true,
      trim: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
    },
    travelDate: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true,
    },
    departureTime: {
      type: String,
      default: '08:00',
    },
    arrivalTime: {
      type: String,
      default: '16:00',
    },
    fare: {
      type: Number,
      required: true,
      default: 500,
    },
    totalSeats: {
      type: Number,
      default: 40,
    },
    // Seats 1 - 38 are normal seats, seats 39 - 40 are emergency seats
    emergencySeats: {
      type: [Number],
      default: [39, 40],
    },
    bookedSeats: {
      type: [Number],
      default: [],
    },
    emergencyBookedSeats: {
      type: [Number],
      default: [],
    },
    status: {
      type: String,
      enum: ['SCHEDULED', 'BOARDING', 'DEPARTED', 'COMPLETED', 'CANCELLED'],
      default: 'SCHEDULED',
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index to prevent duplicate trip records for the same bus and travel date
tripSchema.index({ bus: 1, travelDate: 1 }, { unique: true });

module.exports = mongoose.model('Trip', tripSchema);
