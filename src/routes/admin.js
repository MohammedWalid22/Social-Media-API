const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// All routes require admin role
router.use(auth.protect, auth.restrictTo('admin', 'moderator'));

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management and moderation endpoints
 */

/**
 * @swagger
 * /admin/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     description: Retrieve general statistics about users, posts, and system status (Requires Admin/Moderator role).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A successful response containing the stats.
 */
router.get('/stats', adminController.getDashboardStats);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users with filters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 */
router.get('/users', adminController.getUsers);

/**
 * @swagger
 * /admin/flagged:
 *   get:
 *     summary: Review flagged content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of flagged items
 */
router.get('/flagged', adminController.getFlaggedContent);

/**
 * @swagger
 * /admin/moderate:
 *   post:
 *     summary: Moderate specific content
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contentId:
 *                 type: string
 *               action:
 *                 type: string
 *     responses:
 *       200:
 *         description: Moderation executed
 */
router.post('/moderate', adminController.moderateContent);

/**
 * @swagger
 * /admin/users/{userId}/suspend:
 *   post:
 *     summary: Suspend or ban a user
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User suspended successfully
 */
router.post('/users/:userId/suspend', rateLimiter.sensitive, adminController.suspendUser);

/**
 * @swagger
 * /admin/logs:
 *   get:
 *     summary: Retrieve system audit logs
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of audit logs
 */
router.get('/logs', adminController.getAuditLogs);

module.exports = router;