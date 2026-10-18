const express = require('express');
const {
  createOrder,
  verifyPayment,
  createPayment,
  getPayments,
  processRefund,
} = require('../controllers/paymentController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/refund', processRefund);
router.post('/', createPayment);
router.get('/', getPayments);

module.exports = router;