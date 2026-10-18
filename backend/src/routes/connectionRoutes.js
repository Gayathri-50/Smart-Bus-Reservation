const express = require('express');
const {
  getActiveManagers,
  getCustomerManagerStatus,
  requestConnection,
  cancelConnectionRequest,
  getManagerConnectionRequests,
  respondToConnectionRequest,
  adminReassignCustomer,
} = require('../controllers/connectionController');
const { authenticateUser, requireAdmin, requireManager } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);

// Customer routes
router.get('/managers', getActiveManagers);
router.get('/my-manager', getCustomerManagerStatus);
router.post('/request', requestConnection);
router.delete('/requests/:id', cancelConnectionRequest);

// Manager routes
router.get('/manager/requests', requireManager, getManagerConnectionRequests);
router.patch('/requests/:id', requireManager, respondToConnectionRequest);

// Admin route
router.post('/admin/reassign', requireAdmin, adminReassignCustomer);

module.exports = router;
