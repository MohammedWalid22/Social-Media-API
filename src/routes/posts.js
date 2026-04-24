const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const commentRoutes = require('./comments');
const insightsController = require('../controllers/insightsController');
const capsuleController = require('../controllers/capsuleController');
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
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *                 description: Post text content
 *               media:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: Up to 10 media files (images or videos)
 *               visibility:
 *                 type: string
 *                 enum: [public, friends, followers, private, custom]
 *                 default: public
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', 
  auth.protect, 
  rateLimiter.post,
  upload.array('media', 10),
  validators.createPost,
  postController.createPost
);

// GET saved posts — must come before /:postId routes
router.get('/saved',
  auth.protect,
  (req, res, next) => postController.getSavedPosts(req, res, next)
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
 *         description: MongoDB ObjectId of the post
 *     responses:
 *       200:
 *         description: Post retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   patch:
 *     summary: Update a post (author only)
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
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 5000
 *               visibility:
 *                 type: string
 *                 enum: [public, friends, followers, private, custom]
 *     responses:
 *       200:
 *         description: Post updated
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
 *                     post:
 *                       $ref: '#/components/schemas/Post'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *   delete:
 *     summary: Delete a post (author or admin)
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
 *         description: Post deleted successfully
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:postId', 
  auth.protect, 
  validators.objectId('postId'),
  (req, res, next) => postController.getPost(req, res, next)
);

router.patch('/:postId', 
  auth.protect, 
  rateLimiter.post,
  validators.objectId('postId'),
  (req, res, next) => postController.updatePost(req, res, next)
);

router.delete('/:postId', 
  auth.protect, 
  validators.objectId('postId'),
  (req, res, next) => postController.deletePost(req, res, next)
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
  (req, res, next) => postController.likePost(req, res, next)
);

// GET reactions with users per type (for modal with tabs)
router.get('/:postId/reactions',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => postController.getPostReactions(req, res, next)
);

// GET list of users who liked a post
router.get('/:postId/likes',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => postController.getPostLikes(req, res, next)
);

// Toggle save/unsave + get saved posts
router.post('/:postId/save',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => postController.savePost(req, res, next)
);

router.get('/saved',
  auth.protect,
  (req, res, next) => postController.getSavedPosts(req, res, next)
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
  (req, res, next) => postController.sharePost(req, res, next)
);

router.post('/:postId/co-authors/respond',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => postController.respondToCoAuthorRequest(req, res, next)
);

// Mount comment routes - supports both text and audio comments
router.post('/:postId/save', 
  auth.protect, 
  validators.objectId('postId'),
  (req, res, next) => postController.savePost(req, res, next)
);

router.delete('/:postId/save', 
  auth.protect, 
  validators.objectId('postId'),
  (req, res, next) => postController.unsavePost(req, res, next)
);

/**
 * @swagger
 * /posts/{postId}/viral-stats:
 *   get:
 *     summary: Get viral coefficient (K-factor) and reach stats for a post
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
 *         description: Viral stats including K-factor, total reach, share depth
 */
router.get('/:postId/viral-stats',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => insightsController.getPostViralStats(req, res, next)
);

/**
 * @swagger
 * /posts/{postId}/share-tree:
 *   get:
 *     summary: Get the share propagation tree for a post
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
 *         description: Share tree with reshares and their engagement
 */
router.get('/:postId/share-tree',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => insightsController.getShareTree(req, res, next)
);

/**
 * @swagger
 * /posts/capsules/mine:
 *   get:
 *     summary: List my sealed time capsule posts
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of pending capsule posts with reveal dates
 */
router.get('/capsules/mine', auth.protect, (req, res, next) => capsuleController.getMyCapsules(req, res, next));

/**
 * @swagger
 * /posts/{postId}/seal:
 *   post:
 *     summary: Seal a post as a time capsule
 *     description: The post will be hidden until the revealAt date, then automatically published.
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [revealAt]
 *             properties:
 *               revealAt:
 *                 type: string
 *                 format: date-time
 *                 example: '2027-01-01T00:00:00Z'
 *               hint:
 *                 type: string
 *                 maxLength: 150
 *                 example: 'Something big is coming...'
 *     responses:
 *       200:
 *         description: Post sealed successfully
 *   delete:
 *     summary: Cancel (unseal) a time capsule before reveal
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
 *         description: Capsule cancelled and post restored
 */
router.post('/:postId/seal',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => capsuleController.seal(req, res, next)
);

router.delete('/:postId/seal',
  auth.protect,
  validators.objectId('postId'),
  (req, res, next) => capsuleController.unseal(req, res, next)
);

router.use('/:postId/comments', commentRoutes);

module.exports = router;