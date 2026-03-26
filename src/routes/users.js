const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');
const validators = require('../middleware/validator');
const { cache } = require('../middleware/cache');

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and profiles
 */

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get current logged in user details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile details
 *   patch:
 *     summary: Update profile details
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *   delete:
 *     summary: Delete user account completely
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deleted successfully
 */
router.get('/me', 
  auth.protect, 
  userController.getMe
);

router.patch('/me', 
  auth.protect, 
  validators.updateProfile, 
  userController.updateMe
);

router.delete('/me', 
  auth.protect, 
  rateLimiter.sensitive, 
  userController.deleteAccount
);

/**
 * @swagger
 * /users/me/saved-posts:
 *   get:
 *     summary: Get saved posts for current user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of saved posts
 */
router.get('/me/saved-posts',
  auth.protect,
  userController.getSavedPosts
);

/**
 * @swagger
 * /users/me/avatar:
 *   patch:
 *     summary: Upload profile avatar
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 */
router.patch('/me/avatar', 
  auth.protect, 
  upload.single('avatar'), 
  userController.uploadAvatar
);

/**
 * @swagger
 * /users/me/cover:
 *   patch:
 *     summary: Upload profile cover photo
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               cover:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Cover uploaded
 */
router.patch('/me/cover', 
  auth.protect, 
  upload.single('cover'), 
  userController.uploadCover
);

/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: Search for users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: A list of users matching query
 */
router.get('/search', 
  auth.protect, 
  validators.pagination, 
  userController.searchUsers
);

/**
 * @swagger
 * /users/{username}:
 *   get:
 *     summary: Get user profile by username
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: username
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/:username', 
  auth.optionalAuth, 
  cache(300),
  userController.getUserProfile
);

/**
 * @swagger
 * /users/{userId}/follow:
 *   post:
 *     summary: Follow or unfollow a user
 *     tags: [Users]
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
 *         description: Follow status updated
 */
router.post('/:userId/follow', 
  auth.protect, 
  rateLimiter.api, 
  validators.objectId('userId'),
  userController.followUser
);

/**
 * @swagger
 * /users/{userId}/followers:
 *   get:
 *     summary: Get followers of a user
 *     tags: [Users]
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
 *         description: List of followers
 */
router.get('/:userId/followers', 
  auth.protect, 
  validators.objectId('userId'),
  validators.pagination,
  userController.getFollowers
);

/**
 * @swagger
 * /users/{userId}/following:
 *   get:
 *     summary: Get users followed by a user
 *     tags: [Users]
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
 *         description: List of following
 */
router.get('/:userId/following', 
  auth.protect, 
  validators.objectId('userId'),
  validators.pagination,
  userController.getFollowing
);

/**
 * @swagger
 * /users/{userId}/block:
 *   post:
 *     summary: Block or unblock a user
 *     tags: [Users]
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
 *         description: Block status updated
 */
router.post('/:userId/block', 
  auth.protect, 
  rateLimiter.api, 
  validators.objectId('userId'),
  userController.blockUser
);

/**
 * @swagger
 * /users/{userId}/mute:
 *   post:
 *     summary: Mute or unmute a user
 *     tags: [Users]
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
 *         description: Mute status updated
 */
router.post('/:userId/mute', 
  auth.protect, 
  validators.objectId('userId'),
  userController.muteUser
);

module.exports = router;