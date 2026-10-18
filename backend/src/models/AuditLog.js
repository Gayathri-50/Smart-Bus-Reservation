const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      name: {
        type: String,
        default: 'System',
      },
      email: {
        type: String,
        default: '',
      },
      role: {
        type: String,
        default: 'admin',
      },
    },
    targetType: {
      type: String,
      enum: ['MANAGER', 'BUS', 'BOOKING', 'PAYMENT', 'USER', 'SYSTEM', 'AUTH', 'BOARDING', 'NOTIFICATION', 'CONNECTION', 'TRIP'],
      default: 'SYSTEM',
    },
    targetId: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
