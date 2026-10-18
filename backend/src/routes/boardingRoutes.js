const express = require('express');
const { verifyBoarding, getBoardingManifest } = require('../controllers/boardingController');
const { authenticateUser, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticateUser);

// Only Managers and Admins can perform boarding operations
router.post('/scan', requireRole('MANAGER', 'ADMIN'), verifyBoarding);
router.get('/manifest', requireRole('MANAGER', 'ADMIN'), getBoardingManifest);

module.exports = router;
