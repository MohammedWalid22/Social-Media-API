const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const validators = require('../middleware/validator');

/**
 * @swagger
 * tags:
 *   name: Messaging
 *   description: Direct messaging formatting and retrieval
 */

/**
 * @swagger
 * /messages/conversations:
 *   get:
 *     summary: Get user's active conversations
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversation threads
 */
router.get('/conversations', 
  auth.protect, 
  messageController.getConversationsList
);

/**
 * @swagger
 * /messages/{userId}:
 *   get:
 *     summary: Get conversation history with specific user
 *     tags: [Messaging]
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
 *         description: Messages list
 */
router.get('/:userId', 
  auth.protect, 
  validators.objectId('userId'),
  validators.pagination,
  messageController.getConversation
);

/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Send a direct message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               recipientId:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 */
router.post('/', 
  auth.protect, 
  rateLimiter.api, 
  validators.sendMessage,
  messageController.sendMessage
);

/**
 * @swagger
 * /messages/{messageId}/read:
 *   patch:
 *     summary: Mark a message as read
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.patch('/:messageId/read', 
  auth.protect, 
  validators.objectId('messageId'),
  messageController.markAsRead
);

/**
 * @swagger
 * /messages/{messageId}:
 *   delete:
 *     summary: Delete a specific message
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted successfully
 */
router.delete('/:messageId', 
  auth.protect, 
  validators.objectId('messageId'),
  messageController.deleteMessage
);

/**
 * @swagger
 * /messages/typing:
 *   post:
 *     summary: Dispatch typing indicator event
 *     tags: [Messaging]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Typing status updated
 */
router.post('/typing', 
  auth.protect, 
  messageController.typingIndicator
);

module.exports = router;