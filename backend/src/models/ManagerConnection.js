const mongoose = require('mongoose');

const managerConnectionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    requestedBy: {
      type: String,
      enum: ['USER', 'MANAGER'],
      default: 'USER',
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast lookup of customer's active requests
managerConnectionSchema.index({ user: 1, status: 1 });
managerConnectionSchema.index({ manager: 1, status: 1 });

module.exports = mongoose.model('ManagerConnection', managerConnectionSchema);
