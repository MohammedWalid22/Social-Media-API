const express = require('express');
const router = express.Router();
const insightsController = require('../controllers/insightsController');
const auth = require('../middleware/auth');
const { cache } = require('../middleware/cache');

/**
 * @swagger
 * tags:
 *   name: Insights
 *   description: Echo Chamber detector, viral leaderboard, and content analytics
 */

/**
 * @swagger
 * /insights/echo-chamber:
 *   get:
 *     summary: Analyze your content diversity (Echo Chamber Detection)
 *     description: Uses Shannon Entropy on your last 30 days of interactions to score how diverse your content consumption is (0 = pure echo chamber, 100 = perfectly diverse).
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Diversity analysis result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     diversityScore:
 *                       type: integer
 *                       description: 0-100 score (higher = more diverse)
 *                       example: 42
 *                     warningLevel:
 *                       type: string
 *                       enum: [healthy, moderate, high, insufficient_data]
 *                     message:
 *                       type: string
 *                     topTopics:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           tag:
 *                             type: string
 *                           count:
 *                             type: integer
 *                           percentage:
 *                             type: integer
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.get('/echo-chamber', auth.protect, cache(300), insightsController.getEchoChamber);

/**
 * @swagger
 * /insights/echo-chamber/trend:
 *   get:
 *     summary: Get diversity trend over time
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 30
 *           default: 14
 *     responses:
 *       200:
 *         description: Daily diversity ratios over the period
 */
router.get('/echo-chamber/trend', auth.protect, insightsController.getEchoChamberTrend);

/**
 * @swagger
 * /insights/viral-leaderboard:
 *   get:
 *     summary: Get the most viral posts on the platform
 *     tags: [Insights]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *     responses:
 *       200:
 *         description: Leaderboard of most viral posts
 */
router.get('/viral-leaderboard', auth.protect, cache(120), insightsController.getViralLeaderboard);

module.exports = router;
