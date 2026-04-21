const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/privacyController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Privacy
 *   description: GDPR-compliant privacy audit logs — see who viewed your profile and posts
 */

/**
 * @swagger
 * /privacy/audit-log:
 *   get:
 *     summary: Get your privacy audit log
 *     description: See all events related to your data — profile views, post views, search appearances. Non-followers are shown as anonymous.
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: event
 *         schema:
 *           type: string
 *           enum: [profile_viewed, post_viewed, search_appeared, follow_request_sent, data_exported, message_request_sent]
 *     responses:
 *       200:
 *         description: Paginated privacy audit log
 *   delete:
 *     summary: Delete all your privacy logs (GDPR right to erasure)
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All logs deleted
 */
router.get('/audit-log', auth.protect, privacyController.getAuditLog);
router.delete('/audit-log', auth.protect, privacyController.clearLog);

/**
 * @swagger
 * /privacy/profile-views:
 *   get:
 *     summary: Get profile view analytics for the past 30 days
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Total views + daily breakdown chart data
 */
router.get('/profile-views', auth.protect, privacyController.getProfileViews);

/**
 * @swagger
 * /privacy/audit-log/summary:
 *   get:
 *     summary: Weekly summary of privacy events by type
 *     tags: [Privacy]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Count per event type for last 7 days
 */
router.get('/audit-log/summary', auth.protect, privacyController.getSummary);

module.exports = router;
