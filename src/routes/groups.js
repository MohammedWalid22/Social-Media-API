const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const auth = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         visibility:
 *           type: string
 *           enum: [public, private]
 *         membersCount:
 *           type: integer
 *         creator:
 *           $ref: '#/components/schemas/UserPublic'
 */

/**
 * @swagger
 * tags:
 *   name: Groups
 *   description: Community groups management
 */

router.use(auth.protect);

/**
 * @swagger
 * /groups:
 *   post:
 *     summary: Create a new group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               visibility:
 *                 type: string
 *                 enum: [public, private]
 *                 default: public
 *     responses:
 *       201:
 *         description: Group created
 *   get:
 *     summary: List all public groups
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of groups
 */
router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group details
 *       403:
 *         description: Private group - access denied
 *       404:
 *         description: Group not found
 */
router.get('/:id', groupController.getGroup);

/**
 * @swagger
 * /groups/{id}/join:
 *   post:
 *     summary: Join a public group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Joined group
 *       400:
 *         description: Already a member
 *       403:
 *         description: Cannot join private group directly
 */
router.post('/:id/join', groupController.joinGroup);

/**
 * @swagger
 * /groups/{id}/leave:
 *   post:
 *     summary: Leave a group
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Left group successfully
 */
router.post('/:id/leave', groupController.leaveGroup);

module.exports = router;
