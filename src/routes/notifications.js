const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');
const validators = require('../middleware/validator');

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Manage account activity alerts and pushes
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieve your notifications overview
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of personal notifications
 */
router.get('/', 
  auth.protect, 
  validators.pagination,
  notificationController.getNotifications
);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark single notification as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully marked the alert as read
 */
router.patch('/:id/read', 
  auth.protect, 
  validators.objectId('id'),
  notificationController.markAsRead
);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all unread notifications as read
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Acknowledged all alerts
 */
router.patch('/read-all', 
  auth.protect, 
  notificationController.markAllAsRead
);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Delete a notification entry
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Removed
 */
router.delete('/:id', 
  auth.protect, 
  validators.objectId('id'),
  notificationController.deleteNotification
);

/**
 * @swagger
 * /notifications/preferences:
 *   patch:
 *     summary: Update notification categories and delivery preferences
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Preferences updated
 */
router.patch('/preferences', 
  auth.protect, 
  notificationController.updatePreferences
);

module.exports = router;