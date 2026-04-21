const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Register external URLs to receive real-time event notifications
 */

/**
 * @swagger
 * /webhooks:
 *   post:
 *     summary: Register a new webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, events]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://myapp.com/hooks/social
 *               events:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [post.created, post.liked, post.commented, post.shared, user.followed, comment.added, capsule.revealed]
 *               description:
 *                 type: string
 *                 maxLength: 200
 *     responses:
 *       201:
 *         description: Webhook registered. Secret shown only once.
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *   get:
 *     summary: List all my webhooks
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of webhooks (secret excluded)
 */
router.post('/', auth.protect, rateLimiter.api, webhookController.create);
router.get('/', auth.protect, webhookController.getAll);

/**
 * @swagger
 * /webhooks/{id}:
 *   delete:
 *     summary: Delete a webhook
 *     tags: [Webhooks]
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
 *         description: Deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', auth.protect, webhookController.remove);

/**
 * @swagger
 * /webhooks/{id}/toggle:
 *   patch:
 *     summary: Enable or disable a webhook
 *     tags: [Webhooks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Webhook updated
 */
router.patch('/:id/toggle', auth.protect, webhookController.toggle);

/**
 * @swagger
 * /webhooks/{id}/test:
 *   post:
 *     summary: Send a test delivery to a webhook URL
 *     tags: [Webhooks]
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
 *         description: Test payload dispatched
 */
router.post('/:id/test', auth.protect, rateLimiter.api, webhookController.test);

module.exports = router;
