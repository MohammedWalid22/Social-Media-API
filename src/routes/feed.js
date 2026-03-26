const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const validators = require('../middleware/validator');
const { cache } = require('../middleware/cache');

/**
 * @swagger
 * tags:
 *   name: Feed
 *   description: Timelines, trending posts, and suggestions
 */

/**
 * @swagger
 * /feed/newsfeed:
 *   get:
 *     summary: Get personalized news feed
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of feed posts
 */
router.get('/newsfeed', 
  auth.protect, 
  rateLimiter.api,
  validators.feedFilter,
  cache(60),
  feedController.getNewsFeed
);

/**
 * @swagger
 * /feed/trending:
 *   get:
 *     summary: Get currently trending posts
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trending posts
 */
router.get('/trending', 
  auth.protect,
  feedController.getTrending
);

/**
 * @swagger
 * /feed/nearby:
 *   get:
 *     summary: Get posts submitted from nearby location
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Nearby posts
 */
router.get('/nearby',
  auth.protect,
  feedController.getNearbyPosts
);

/**
 * @swagger
 * /feed/suggested-users:
 *   get:
 *     summary: Get user suggestions to follow
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suggested users
 */
router.get('/suggested-users',
  auth.protect,
  validators.pagination,
  feedController.getSuggestedUsers
);

/**
 * @swagger
 * /feed/suggested-posts:
 *   get:
 *     summary: Get post suggestions based on interactions
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of suggested posts
 */
router.get('/suggested-posts',
  auth.protect,
  validators.pagination,
  feedController.getSuggestedPosts
);

module.exports = router;