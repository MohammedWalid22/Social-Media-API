const PrivacyLog = require('../models/PrivacyLog');
const logger = require('../utils/logger');

/**
 * Privacy Logger Middleware
 *
 * Usage:
 *   router.get('/profile', privacyLogger('profile_viewed', 'profile'), handler)
 *
 * @param {string} event  - The privacy event type
 * @param {string} resourceType - 'profile' | 'post' | 'comment'
 * @param {Function} [getTargetUser] - Function(req) → userId of the target. Defaults to req.params.userId or post author
 */
const privacyLogger = (event, resourceType, getTargetUser) => {
  return async (req, res, next) => {
    // Run after the response is sent — never block the request
    res.on('finish', async () => {
      // Only log successful responses
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      try {
        let targetUser;

        if (typeof getTargetUser === 'function') {
          targetUser = getTargetUser(req);
        } else if (req.params.userId) {
          targetUser = req.params.userId;
        } else if (req.viewedPost?.author) {
          targetUser = req.viewedPost.author;
        } else {
          return; // Can't determine target — skip
        }

        if (!targetUser) return;

        // Don't log self-views
        const actorId = req.user?._id?.toString();
        if (actorId && actorId === targetUser.toString()) return;

        await PrivacyLog.create({
          targetUser,
          actor: actorId || null,
          event,
          source: detectSource(req),
          resource: req.params.postId || req.params.commentId || null,
          resourceType: resourceType || null,
        });
      } catch (err) {
        logger.warn('PrivacyLogger error:', err.message);
      }
    });

    next();
  };
};

/** Detect access source from referrer or route context */
function detectSource(req) {
  const referer = req.headers.referer || '';
  if (referer.includes('/feed')) return 'feed';
  if (referer.includes('/search')) return 'search';
  if (referer.includes('/suggestion')) return 'suggestion';
  if (referer.includes('/notification')) return 'notification';
  return 'direct';
}

module.exports = privacyLogger;
