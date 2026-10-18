const express = require('express');
const {
  getBuses,
  getBusById,
  createBus,
} = require('../controllers/busController');
const { authenticateUser, requireRole } = require('../middleware/authMiddleware');
const Bus = require('../models/Bus');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.get('/', getBuses);
router.get('/:id', getBusById);
router.post('/', authenticateUser, requireRole('ADMIN', 'MANAGER'), createBus);

// Start Bus Journey & dispatch live safety status alerts to all guardians
router.post('/:id/start-journey', authenticateUser, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { currentLocation } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    bus.tripStatus = 'STARTED';
    bus.startedAt = new Date();
    if (currentLocation) bus.currentLocation = currentLocation;
    await bus.save();

    const notifResult = await notificationService.sendBusStartedNotifications({
      busId: bus._id,
      startedAt: bus.startedAt,
      currentLocation: bus.currentLocation || bus.from,
    });

    res.json({
      success: true,
      message: `Bus journey started! Guardian safety messages dispatched to ${notifResult.notificationsDispatched} recipients.`,
      bus,
      notifResult,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to start bus journey', error: error.message });
  }
});

// Update Bus Status (SCHEDULED, BOARDING, STARTED, COMPLETED, CANCELLED)
router.patch('/:id/status', authenticateUser, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const { status, currentLocation } = req.body;
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    const previousStatus = bus.tripStatus;
    if (status) bus.tripStatus = status;
    if (currentLocation) bus.currentLocation = currentLocation;
    if (status === 'STARTED' && previousStatus !== 'STARTED') {
      bus.startedAt = new Date();
    }
    await bus.save();

    let notifResult = null;
    if (status === 'STARTED' && previousStatus !== 'STARTED') {
      notifResult = await notificationService.sendBusStartedNotifications({
        busId: bus._id,
        startedAt: bus.startedAt,
        currentLocation: bus.currentLocation || bus.from,
      });
    }

    res.json({
      success: true,
      message: `Bus status updated to ${bus.tripStatus}.${notifResult ? ` Guardian messages dispatched to ${notifResult.notificationsDispatched} contacts.` : ''}`,
      bus,
      notifResult,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update bus status', error: error.message });
  }
});

module.exports = router;