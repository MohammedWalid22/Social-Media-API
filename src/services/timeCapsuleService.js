const Post = require('../models/Post');
const NotificationService = require('./notificationService');
const WebhookService = require('./webhookService');
const logger = require('../utils/logger');

class TimeCapsuleService {
  /**
   * Reveal all capsule posts whose revealAt time has passed.
   * Called by Cron every minute.
   */
  async revealDueCapsules() {
    try {
      const due = await Post.find({
        isCapsule: true,
        capsuleStatus: 'sealed',
        capsuleRevealAt: { $lte: new Date() },
      }).populate('author', '_id username followers');

      if (!due.length) return;

      for (const post of due) {
        // Reveal the post
        post.capsuleStatus = 'revealed';
        post.visibility = post._capsuleOriginalVisibility || 'public';
        await post.save();

        logger.info(`⏳ Time Capsule revealed: ${post._id} by ${post.author?.username}`);

        // Notify author
        await NotificationService.create({
          recipient: post.author._id,
          type: 'capsule_revealed',
          post: post._id,
        }).catch(() => {});

        // Trigger webhook event
        WebhookService.trigger('capsule.revealed', {
          postId: post._id,
          authorId: post.author._id,
          revealedAt: new Date(),
          hint: post.capsuleHint,
        }).catch(() => {});
      }

      logger.info(`⏳ Revealed ${due.length} time capsule(s)`);
    } catch (err) {
      logger.error('TimeCapsuleService.revealDueCapsules error:', err);
    }
  }

  /** Seal an existing post as a time capsule */
  async sealPost(postId, userId, revealAt, hint) {
    const post = await Post.findOne({ _id: postId, author: userId });
    if (!post) return null;

    post.isCapsule = true;
    post.capsuleStatus = 'sealed';
    post.capsuleRevealAt = new Date(revealAt);
    post.capsuleHint = hint || null;
    // Hide from feed until revealed
    post._capsuleOriginalVisibility = post.visibility;
    post.visibility = 'private';
    await post.save();

    return post;
  }

  /** Cancel a pending capsule (restore original visibility) */
  async unsealPost(postId, userId) {
    const post = await Post.findOne({ _id: postId, author: userId, isCapsule: true, capsuleStatus: 'sealed' });
    if (!post) return null;

    post.isCapsule = false;
    post.capsuleStatus = undefined;
    post.capsuleRevealAt = undefined;
    post.capsuleHint = undefined;
    post.visibility = post._capsuleOriginalVisibility || 'public';
    await post.save();

    return post;
  }
}

module.exports = new TimeCapsuleService();
