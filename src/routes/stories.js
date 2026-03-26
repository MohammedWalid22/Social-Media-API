const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Stories
 *   description: Timed expiring content and highlights functionality
 */

/**
 * @swagger
 * /stories:
 *   post:
 *     summary: Publish a new expiring story
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               media:
 *                 type: string
 *                 format: binary
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Formatted story created natively
 */
router.post('/', 
  auth.protect, 
  rateLimiter.post,
  upload.single('media'), 
  storyController.createStory
);

/**
 * @swagger
 * /stories/feed:
 *   get:
 *     summary: Get stories feed from followed accounts
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Actively running stories from network
 */
router.get('/feed', 
  auth.protect, 
  storyController.getStoriesFeed
);

/**
 * @swagger
 * /stories/user/{userId}:
 *   get:
 *     summary: View the stories belonging to an exact user
 *     tags: [Stories]
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
 *         description: Available timeline artifacts explicitly generated
 */
router.get('/user/:userId', 
  auth.protect, 
  storyController.getUserStories
);

/**
 * @swagger
 * /stories/{storyId}/view:
 *   post:
 *     summary: Record viewed status
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Add self implicitly to viewer list
 */
router.post('/:storyId/view', 
  auth.protect, 
  storyController.viewStory
);

/**
 * @swagger
 * /stories/{storyId}/reaction:
 *   post:
 *     summary: Send a fast reaction to a story
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sent an emoji or emotion action properly
 */
router.post('/:storyId/reaction', 
  auth.protect, 
  storyController.reactToStory
);

/**
 * @swagger
 * /stories/{storyId}/highlight:
 *   post:
 *     summary: Convert story to an archived highlight section
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Story properly stored on profile unconditionally
 */
router.post('/:storyId/highlight', 
  auth.protect, 
  storyController.addToHighlights
);

/**
 * @swagger
 * /stories/{storyId}:
 *   delete:
 *     summary: Delete a story artifact before global exit logic runs
 *     tags: [Stories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storyId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Deleted natively from storage safely
 */
router.delete('/:storyId', 
  auth.protect, 
  storyController.deleteStory
);

module.exports = router;