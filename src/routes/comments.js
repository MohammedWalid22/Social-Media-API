const express = require('express');
const router = express.Router({ mergeParams: true });
const commentController = require('../controllers/commentController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const validators = require('../middleware/validator');

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Post comments, audio interactions, and likes
 */

/**
 * @swagger
 * /posts/{postId}/comments:
 *   post:
 *     summary: Add a text comment to a post
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
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
 *               content:
 *                 type: string
 *               parentCommentId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 *   get:
 *     summary: Get comments for a post
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 */
router.post('/',
  auth.protect,
  rateLimiter.api,
  validators.createComment,
  commentController.createComment
);

router.get('/',
  auth.protect,
  validators.pagination,
  commentController.getComments
);

/**
 * @swagger
 * /posts/{postId}/comments/audio:
 *   post:
 *     summary: Add an audio comment to a post
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               audio:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Audio comment added
 */
router.post('/audio',
  auth.protect,
  rateLimiter.post,
  upload.audio.single('audio'),
  commentController.createAudioComment
);

/**
 * @swagger
 * /comments/audio/{audioCommentId}/play:
 *   post:
 *     summary: Record audio play event
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: audioCommentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Play event recorded
 */
router.post('/audio/:audioCommentId/play',
  auth.protect,
  validators.objectId('audioCommentId'),
  commentController.recordAudioPlay
);

/**
 * @swagger
 * /comments/audio/{audioCommentId}/transcription:
 *   get:
 *     summary: Get generated transcription of audio comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: audioCommentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Transcription retrieved
 */
router.get('/audio/:audioCommentId/transcription',
  auth.protect,
  validators.objectId('audioCommentId'),
  commentController.getTranscription
);

/**
 * @swagger
 * /comments/audio/{audioCommentId}/speed:
 *   patch:
 *     summary: Adjust playback speed settings for audio
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: audioCommentId
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
 *               speed:
 *                 type: number
 *     responses:
 *       200:
 *         description: Speed updated
 */
router.patch('/audio/:audioCommentId/speed',
  auth.protect,
  validators.objectId('audioCommentId'),
  commentController.updatePlaybackSpeed
);

/**
 * @swagger
 * /comments/{commentId}/react:
 *   post:
 *     summary: Toggle reaction on a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reaction:
 *                 type: string
 *                 enum: [like, love, laugh, angry, sad]
 *     responses:
 *       200:
 *         description: Reaction toggled
 */
router.post('/:commentId/react',
  auth.protect,
  rateLimiter.api,
  validators.objectId('commentId'),
  commentController.reactToComment
);

/**
 * @swagger
 * /comments/{commentId}:
 *   delete:
 *     summary: Delete a comment safely
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Comment deleted
 */
router.delete('/:commentId',
  auth.protect,
  validators.objectId('commentId'),
  commentController.deleteComment
);

module.exports = router;