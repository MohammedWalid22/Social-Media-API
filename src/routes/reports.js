const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       required:
 *         - targetType
 *         - targetId
 *         - reason
 *       properties:
 *         targetType:
 *           type: string
 *           enum: [user, post, comment]
 *         targetId:
 *           type: string
 *         reason:
 *           type: string
 *           enum: [spam, hate_speech, harassment, violence, misinformation, nudity, other]
 *         details:
 *           type: string
 *         status:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 */

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Content and user reporting system
 */


router.use(auth.protect);

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Create a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Report'
 *           example:
 *             targetType: post
 *             targetId: 64a1b2c3d4e5f6g7h8i9j0k1
 *             reason: spam
 *             details: This post is promotional spam
 *     responses:
 *       201:
 *         description: Report submitted successfully
 *       400:
 *         description: Validation error
 *   get:
 *     summary: Get all reports (Moderator/Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, reviewed, resolved, dismissed]
 *     responses:
 *       200:
 *         description: List of reports
 *       403:
 *         description: Access denied
 */
router.post('/', reportController.createReport);
router.get('/', reportController.getReports);

/**
 * @swagger
 * /reports/{id}/status:
 *   patch:
 *     summary: Update report status (Moderator/Admin only)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewed, resolved, dismissed]
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 *       404:
 *         description: Report not found
 */
router.patch('/:id/status', reportController.updateReportStatus);

module.exports = router;
