const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authLimiter, sanitizeInput, validateLogin, validateAddEmployee } = require('../middleware/security');
const { authenticateAdmin } = require('../middleware/auth');

// Public route
router.post('/login', authLimiter, sanitizeInput, validateLogin, adminController.login);

// Private routes (authenticated admin)
router.get('/requests', authenticateAdmin, adminController.getPendingRequests);
router.post('/requests/:empid/approve', authenticateAdmin, adminController.approveRequest);
router.post('/requests/:empid/decline', authenticateAdmin, adminController.declineRequest);

router.get('/employees', authenticateAdmin, adminController.getEmployees);
router.post('/employees', authenticateAdmin, sanitizeInput, validateAddEmployee, adminController.addEmployee);
router.delete('/employees/:empid', authenticateAdmin, adminController.deleteEmployee);

router.post('/logout', adminController.logout);

module.exports = router;
