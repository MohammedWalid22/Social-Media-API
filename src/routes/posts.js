const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const commentRoutes = require('./comments');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const validators = require('../middleware/validator');

/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: Post creation, deletion, liking and sharing
 */

/**
 * @swagger
 * /posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
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
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *               text:
 *                 type: string
 *     responses:
 *       201:
 *         description: Post created successfully
 */
router.post('/', 
  auth.protect, 
  rateLimiter.post,
  upload.array('media', 10),
  validators.createPost,
  postController.createPost
);

/**
 * @swagger
 * /posts/{postId}:
 *   get:
 *     summary: Get a specific post by ID
 *     tags: [Posts]
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
 *         description: Post retrieved
 *   patch:
 *     summary: Update a post
 *     tags: [Posts]
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
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Post updated
 *   delete:
 *     summary: Delete a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Post deleted 
 */
router.get('/:postId', 
  auth.protect, 
  validators.objectId('postId'),
  postController.getPost
);

router.patch('/:postId', 
  auth.protect, 
  rateLimiter.post,
  validators.objectId('postId'),
  postController.updatePost
);

router.delete('/:postId', 
  auth.protect, 
  validators.objectId('postId'),
  postController.deletePost
);

/**
 * @swagger
 * /posts/{postId}/like:
 *   post:
 *     summary: Like or unlike a post
 *     tags: [Posts]
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
 *         description: Updated like status
 */
router.post('/:postId/like', 
  auth.protect, 
  rateLimiter.api,
  validators.objectId('postId'),
  postController.likePost
);

/**
 * @swagger
 * /posts/{postId}/share:
 *   post:
 *     summary: Share a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Post shared
 */
router.post('/:postId/share', 
  auth.protect, 
  rateLimiter.api,
  validators.objectId('postId'),
  postController.sharePost
);

router.post('/:postId/co-authors/respond',
  auth.protect,
  validators.objectId('postId'),
  postController.respondToCoAuthorRequest
);

// Mount comment routes - supports both text and audio comments
router.post('/:postId/save', 
  auth.protect, 
  validators.objectId('postId'),
  postController.savePost
);

router.delete('/:postId/save', 
  auth.protect, 
  validators.objectId('postId'),
  postController.unsavePost
);

router.use('/:postId/comments', commentRoutes);

module.exports = router;