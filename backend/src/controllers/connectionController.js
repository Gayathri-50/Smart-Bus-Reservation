const User = require('../models/User');
const ManagerConnection = require('../models/ManagerConnection');
const AuditLog = require('../models/AuditLog');
const { getNormalizedRole } = require('../middleware/authMiddleware');

/**
 * List active managers for customer search
 */
const getActiveManagers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = {
      role: { $in: ['MANAGER', 'manager', 'bus_manager', 'booking_manager', 'finance_manager'] },
      isActive: true,
    };

    if (search) {
      const term = String(search).trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { managerCode: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
      ];
    }

    const managers = await User.find(query).select('name email phone managerCode createdAt').sort({ name: 1 });
    res.json({ success: true, managers });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch managers', error: err.message });
  }
};

/**
 * Get customer's current manager and pending connection requests
 */
const getCustomerManagerStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('manager', 'name email phone managerCode');

    const pendingRequest = await ManagerConnection.findOne({
      user: req.user._id,
      status: 'PENDING',
    }).populate('manager', 'name email phone managerCode');

    const pastRequests = await ManagerConnection.find({
      user: req.user._id,
    })
      .populate('manager', 'name email phone managerCode')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      currentManager: user.manager || null,
      pendingRequest: pendingRequest || null,
      history: pastRequests,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch manager status', error: err.message });
  }
};

/**
 * Customer sends connection request to a manager
 */
const requestConnection = async (req, res) => {
  try {
    const { managerId, notes } = req.body;

    if (!managerId) {
      return res.status(400).json({ success: false, message: 'Manager ID is required' });
    }

    const targetManager = await User.findById(managerId);
    if (!targetManager || getNormalizedRole(targetManager) !== 'MANAGER' || !targetManager.isActive) {
      return res.status(404).json({ success: false, message: 'Manager not found or inactive' });
    }

    // Check if user is already connected to this manager
    const currentUser = await User.findById(req.user._id);
    if (String(currentUser.manager) === String(targetManager._id)) {
      return res.status(400).json({ success: false, message: 'You are already connected to this manager.' });
    }

    // Check for existing pending request
    const existingPending = await ManagerConnection.findOne({
      user: req.user._id,
      status: 'PENDING',
    });

    if (existingPending) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending connection request. Please wait for response or cancel it.',
      });
    }

    const connection = await ManagerConnection.create({
      user: req.user._id,
      manager: targetManager._id,
      status: 'PENDING',
      requestedBy: 'USER',
      notes: String(notes || ''),
    });

    await AuditLog.create({
      action: 'USER_REQUESTED_MANAGER',
      performedBy: { id: req.user._id, name: req.user.name, email: req.user.email, role: 'CUSTOMER' },
      targetType: 'CONNECTION',
      targetId: String(connection._id),
      details: {
        managerId: targetManager._id,
        managerName: targetManager.name,
        managerEmail: targetManager.email,
      },
    });

    res.status(201).json({
      success: true,
      message: `Connection request sent to Manager ${targetManager.name}.`,
      connection,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to send connection request', error: err.message });
  }
};

/**
 * Cancel a pending connection request (Customer only)
 */
const cancelConnectionRequest = async (req, res) => {
  try {
    const request = await ManagerConnection.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
      status: 'PENDING',
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending request not found' });
    }

    res.json({ success: true, message: 'Connection request cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to cancel request', error: err.message });
  }
};

/**
 * Manager gets their connection requests
 */
const getManagerConnectionRequests = async (req, res) => {
  try {
    const requests = await ManagerConnection.find({
      manager: req.user._id,
    })
      .populate('user', 'name email phone createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch requests', error: err.message });
  }
};

/**
 * Manager responds to a connection request (Accept / Reject)
 */
const respondToConnectionRequest = async (req, res) => {
  try {
    const { status } = req.body; // 'ACCEPTED' | 'REJECTED'

    if (!['ACCEPTED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be ACCEPTED or REJECTED' });
    }

    const connection = await ManagerConnection.findOne({
      _id: req.params.id,
      manager: req.user._id,
      status: 'PENDING',
    }).populate('user');

    if (!connection) {
      return res.status(404).json({ success: false, message: 'Pending connection request not found' });
    }

    connection.status = status;
    connection.respondedAt = new Date();
    await connection.save();

    if (status === 'ACCEPTED') {
      // Set customer's active manager to this manager
      await User.findByIdAndUpdate(connection.user._id, {
        manager: req.user._id,
      });

      // Mark any other pending requests for this user as REJECTED/CLOSED
      await ManagerConnection.updateMany(
        { user: connection.user._id, _id: { $ne: connection._id }, status: 'PENDING' },
        { status: 'REJECTED', respondedAt: new Date(), notes: 'Superseded by new accepted manager' }
      );
    }

    await AuditLog.create({
      action: status === 'ACCEPTED' ? 'MANAGER_ACCEPTED_USER' : 'MANAGER_REJECTED_USER',
      performedBy: { id: req.user._id, name: req.user.name, email: req.user.email, role: 'MANAGER' },
      targetType: 'CONNECTION',
      targetId: String(connection._id),
      details: {
        userId: connection.user._id,
        userName: connection.user.name,
        userEmail: connection.user.email,
        status,
      },
    });

    res.json({
      success: true,
      message: `Connection request ${status.toLowerCase()} successfully.`,
      connection,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to respond to request', error: err.message });
  }
};

/**
 * Admin reassigns a customer to a manager
 */
const adminReassignCustomer = async (req, res) => {
  try {
    const { userId, managerId } = req.body;

    if (!userId || !managerId) {
      return res.status(400).json({ success: false, message: 'User ID and Manager ID are required' });
    }

    const customer = await User.findById(userId);
    if (!customer) return res.status(404).json({ success: false, message: 'Customer not found' });

    const manager = await User.findById(managerId);
    if (!manager || getNormalizedRole(manager) !== 'MANAGER') {
      return res.status(404).json({ success: false, message: 'Manager not found' });
    }

    const previousManagerId = customer.manager;
    customer.manager = manager._id;
    await customer.save();

    // Create an accepted connection record
    await ManagerConnection.create({
      user: customer._id,
      manager: manager._id,
      status: 'ACCEPTED',
      requestedBy: 'MANAGER',
      respondedAt: new Date(),
      notes: 'Direct assignment by Administrator',
    });

    await AuditLog.create({
      action: 'ADMIN_REASSIGNED_USER',
      performedBy: { id: req.user._id, name: req.user.name, email: req.user.email, role: 'ADMIN' },
      targetType: 'USER',
      targetId: String(customer._id),
      details: {
        customerEmail: customer.email,
        previousManager: previousManagerId,
        newManager: manager._id,
        newManagerName: manager.name,
      },
    });

    res.json({
      success: true,
      message: `Customer ${customer.name} reassigned to Manager ${manager.name}.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Reassignment failed', error: err.message });
  }
};

module.exports = {
  getActiveManagers,
  getCustomerManagerStatus,
  requestConnection,
  cancelConnectionRequest,
  getManagerConnectionRequests,
  respondToConnectionRequest,
  adminReassignCustomer,
};
