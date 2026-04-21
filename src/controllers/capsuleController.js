const TimeCapsuleService = require('../services/timeCapsuleService');
const Post = require('../models/Post');
const { AppError } = require('../middleware/errorHandler');

class CapsuleController {
  /**
   * POST /api/v1/posts
   * Extended to support capsule fields inline with createPost.
   * This controller handles the dedicated capsule endpoints.
   */

  /** POST /api/v1/posts/:postId/seal — Seal an existing post as a capsule */
  async seal(req, res, next) {
    try {
      const { revealAt, hint } = req.body;

      if (!revealAt) {
        return next(new AppError('revealAt date/time is required', 400));
      }

      const revealDate = new Date(revealAt);
      if (revealDate <= new Date()) {
        return next(new AppError('revealAt must be a future date', 400));
      }

      const post = await TimeCapsuleService.sealPost(req.params.postId, req.user._id, revealDate, hint);
      if (!post) return next(new AppError('Post not found or not authorized', 404));

      res.status(200).json({
        status: 'success',
        message: `⏳ Post sealed! It will be revealed on ${revealDate.toDateString()}.`,
        data: {
          postId: post._id,
          capsuleRevealAt: post.capsuleRevealAt,
          capsuleHint: post.capsuleHint,
          capsuleStatus: post.capsuleStatus,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/v1/posts/:postId/seal — Unseal (cancel) a capsule */
  async unseal(req, res, next) {
    try {
      const post = await TimeCapsuleService.unsealPost(req.params.postId, req.user._id);
      if (!post) return next(new AppError('Capsule not found or already revealed', 404));

      res.status(200).json({
        status: 'success',
        message: 'Post unsealed and restored to its original visibility.',
        data: { postId: post._id, visibility: post.visibility },
      });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/posts/capsules/mine — List my pending capsules */
  async getMyCapsules(req, res, next) {
    try {
      const capsules = await Post.find({
        author: req.user._id,
        isCapsule: true,
        capsuleStatus: 'sealed',
      })
        .select('capsuleRevealAt capsuleHint capsuleStatus content.text createdAt')
        .sort('capsuleRevealAt')
        .lean();

      res.status(200).json({
        status: 'success',
        results: capsules.length,
        data: { capsules },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CapsuleController();
