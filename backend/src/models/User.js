const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    role: {
      type: String,
      enum: [
        'ADMIN',
        'admin',
        'SUPER_ADMIN',
        'super_admin',
        'MANAGER',
        'manager',
        'BUS_MANAGER',
        'bus_manager',
        'BOOKING_MANAGER',
        'booking_manager',
        'FINANCE_MANAGER',
        'finance_manager',
        'CUSTOMER',
        'customer',
        'user',
        'USER',
      ],
      default: 'CUSTOMER',
    },
    managerCode: {
      type: String,
      default: null,
      trim: true,
    },
    manager: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    guardian: {
      name: {
        type: String,
        default: '',
        trim: true,
      },
      phone: {
        type: String,
        default: '',
        trim: true,
      },
      email: {
        type: String,
        default: '',
        trim: true,
        lowercase: true,
      },
      relationship: {
        type: String,
        default: 'Parent / Guardian',
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Normalize role helper
userSchema.methods.getNormalizedRole = function () {
  const r = (this.role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return 'ADMIN';
  if (r === 'BUS_MANAGER') return 'BUS_MANAGER';
  if (r === 'BOOKING_MANAGER') return 'BOOKING_MANAGER';
  if (r === 'FINANCE_MANAGER') return 'FINANCE_MANAGER';
  if (r === 'MANAGER') return 'MANAGER';
  return 'CUSTOMER';
};

module.exports = mongoose.model('User', userSchema);