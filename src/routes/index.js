const express = require('express');
const router = express.Router();

// Import all route modules
const authRoutes = require('./auth');
const userRoutes = require('./users');
const postRoutes = require('./posts');
const commentRoutes = require('./comments');
const feedRoutes = require('./feed');
const messageRoutes = require('./messages');
const notificationRoutes = require('./notifications');
const adminRoutes = require('./admin');
const storyRoutes = require('./stories');
const stickerRoutes = require('./stickers');
const reportRoutes = require('./reports');
const groupRoutes = require('./groups');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
// Comments are mounted under posts as /posts/:postId/comments
router.use('/feed', feedRoutes);
router.use('/messages', messageRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);
router.use('/stories', storyRoutes);
router.use('/stickers', stickerRoutes);
router.use('/reports', reportRoutes);
router.use('/groups', groupRoutes);

/**
 * @swagger
 * tags:
 *   name: Core
 *   description: Core system operations
 */

/**
 * @swagger
 * /status:
 *   get:
 *     summary: Get overall API status and environment info
 *     tags: [Core]
 *     responses:
 *       200:
 *         description: System operational and responsive
 */
// API status
router.get('/status', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

module.exports = router;