const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendEmail } = require('../services/emailService');

const getAdminEmail = () => String(process.env.ADMIN_EMAIL || 'admin@busbook.com').trim().toLowerCase();

const resolveUserRole = (user) => {
  const adminEmail = getAdminEmail();
  const normalizedEmail = String(user?.email || '').trim().toLowerCase();

  if (normalizedEmail === adminEmail) {
    return 'ADMIN';
  }

  const r = String(user?.role || '').toUpperCase();
  if (r === 'ADMIN' || r === 'SUPER_ADMIN') return 'ADMIN';
  if (r === 'BUS_MANAGER') return 'bus_manager';
  if (r === 'BOOKING_MANAGER') return 'booking_manager';
  if (r === 'FINANCE_MANAGER') return 'finance_manager';
  if (r === 'MANAGER') return 'bus_manager';
  return 'CUSTOMER';
};

const createToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

const registerUser = async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const password = String(req.body?.password || '');

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (email === getAdminEmail()) {
      return res.status(403).json({ success: false, message: 'Admin account is managed by the backend configuration.' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already exists with this email address' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // SECURITY: Public registration ALWAYS creates role = CUSTOMER, manager = null
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role: 'CUSTOMER',
      manager: null,
      isActive: true,
    });

    const token = createToken(user._id);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'CUSTOMER',
        manager: null,
        isActive: user.isActive,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Registration failed', error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).populate('manager', 'name email phone managerCode');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
      });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const effectiveRole = resolveUserRole(user);
    if (effectiveRole === 'ADMIN' && user.role !== 'ADMIN') {
      user.role = 'ADMIN';
      await user.save();
    }

    const token = createToken(user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: effectiveRole,
        manager: user.manager || null,
        managerCode: user.managerCode || null,
        isActive: user.isActive,
      },
      token,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login failed', error: error.message });
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour validity
      await user.save();

      try {
        const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
        const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

        await sendEmail({
          to: user.email,
          subject: 'Password Reset Request — BusBook',
          text: `Hello ${user.name},\n\nYou requested a password reset for your BusBook account.\nClick the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour. If you did not make this request, please ignore this email.`,
          html: `<div style="font-family: Arial, sans-serif; padding: 20px;"><h2>BusBook Password Reset</h2><p>Hello <strong>${user.name}</strong>,</p><p>You requested a password reset for your account.</p><p><a href="${resetUrl}" style="background: #4f46e5; color: white; padding: 10px 18px; text-decoration: none; border-radius: 6px;">Reset My Password</a></p><p style="color: #64748b; font-size: 12px;">This link will expire in 1 hour.</p></div>`,
        });
      } catch (mailErr) {
        console.warn('Password reset notification dispatch note:', mailErr.message);
      }
    }

    res.json({
      success: true,
      message: 'If an account exists with that email address, a password reset link has been dispatched.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Forgot password failed', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Reset token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired. Please request a new one.',
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Password has been reset successfully. You can now login.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Password reset failed', error: error.message });
  }
};

const getCurrentUser = async (req, res) => {
  const user = await User.findById(req.user._id)
    .select('-password')
    .populate('manager', 'name email phone managerCode');

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: resolveUserRole(user),
    guardian: user.guardian || null,
    manager: user.manager || null,
    managerCode: user.managerCode || null,
    isActive: user.isActive,
  });
};

const updateUserProfile = async (req, res) => {
  try {
    const { name, phone, guardian } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (name) user.name = String(name).trim();
    if (phone) user.phone = String(phone).trim();
    if (guardian && typeof guardian === 'object') {
      user.guardian = {
        name: String(guardian.name || '').trim(),
        phone: String(guardian.phone || '').trim(),
        email: String(guardian.email || '').trim().toLowerCase(),
        relationship: String(guardian.relationship || 'Parent / Guardian').trim(),
      };
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: resolveUserRole(user),
        guardian: user.guardian,
        manager: user.manager || null,
        managerCode: user.managerCode || null,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile', error: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to change password', error: err.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateUserProfile,
  changePassword,
  getAdminEmail,
  resolveUserRole,
};