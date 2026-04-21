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
  (req, res, next) => feedController.getNewsFeed(req, res, next)
);

/**
 * @swagger
 * /feed/trending:
 *   get:
 *     summary: Get currently trending posts
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *         description: Time window for trending calculation (default 24h)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of results (default 20)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (default 1)
 *     responses:
 *       200:
 *         description: Trending posts
 */
router.get('/trending', 
  auth.protect,
  validators.pagination,
  cache(300),
  (req, res, next) => feedController.getTrending(req, res, next)
);

/**
 * @swagger
 * /feed/nearby:
 *   get:
 *     summary: Get posts submitted from nearby location
 *     tags: [Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: integer
 *         description: Search radius in meters (default 5000)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Number of results (default 20)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number (default 1)
 *     responses:
 *       200:
 *         description: Nearby posts
 */
router.get('/nearby',
  auth.protect,
  validators.pagination,
  (req, res, next) => feedController.getNearbyPosts(req, res, next)
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
  (req, res, next) => feedController.getSuggestedUsers(req, res, next)
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
  (req, res, next) => feedController.getSuggestedPosts(req, res, next)
);

module.exports = router;