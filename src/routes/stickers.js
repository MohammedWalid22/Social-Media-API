const express = require('express');
const router = express.Router();
const stickerController = require('../controllers/stickerController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

/**
 * @swagger
 * tags:
 *   name: Stickers
 *   description: Sticker catalog, comments, and personal collections
 */

/**
 * @swagger
 * /stickers:
 *   get:
 *     summary: Get all available stickers
 *     tags: [Stickers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search on name/tags
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of stickers
 */
router.get('/', auth.optionalAuth, stickerController.getAllStickers);

/**
 * @swagger
 * /stickers/categories:
 *   get:
 *     summary: Get all sticker categories
 *     tags: [Stickers]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get('/categories', stickerController.getCategories);

/**
 * @swagger
 * /stickers/me/collection:
 *   get:
 *     summary: Get the authenticated user's sticker collection
 *     tags: [Stickers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's saved stickers
 */
router.get('/me/collection', auth.protect, stickerController.getMyCollection);

/**
 * @swagger
 * /stickers/{stickerId}:
 *   get:
 *     summary: Get a single sticker by ID
 *     tags: [Stickers]
 *     parameters:
 *       - in: path
 *         name: stickerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sticker details
 */
router.get('/:stickerId', stickerController.getStickerById);

/**
 * @swagger
 * /stickers:
 *   post:
 *     summary: Create a new sticker (Admin only)
 *     tags: [Stickers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               tags:
 *                 type: string
 *                 description: Comma-separated tags
 *     responses:
 *       201:
 *         description: Sticker created
 */
router.post(
  '/',
  auth.protect,
  // Only admins can create stickers
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Only admins can create stickers' });
    }
    next();
  },
  upload.single('image'),
  stickerController.createSticker
);

/**
 * @swagger
 * /stickers/{stickerId}/collect:
 *   post:
 *     summary: Toggle sticker in/out of user's personal collection
 *     tags: [Stickers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stickerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Collection updated
 */
router.post('/:stickerId/collect', auth.protect, rateLimiter.api, stickerController.collectSticker);

/**
 * @swagger
 * /stickers/{stickerId}/moderate:
 *   patch:
 *     summary: Flag or unflag sticker as offensive (Admin only)
 *     tags: [Stickers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stickerId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isOffensive:
 *                 type: boolean
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sticker moderation updated
 */
router.patch(
  '/:stickerId/moderate',
  auth.protect,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Only admins can moderate stickers' });
    }
    next();
  },
  stickerController.moderateSticker
);

/**
 * @swagger
 * /stickers/{stickerId}:
 *   delete:
 *     summary: Delete a sticker (Admin only)
 *     tags: [Stickers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: stickerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Sticker deleted
 */
router.delete(
  '/:stickerId',
  auth.protect,
  (req, res, next) => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ status: 'fail', message: 'Only admins can delete stickers' });
    }
    next();
  },
  stickerController.deleteSticker
);

module.exports = router;
