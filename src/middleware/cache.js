const redisManager = require('../config/redis');
const logger = require('../utils/logger');

/**
 * Generic caching middleware
 * @param {number} duration - Cache duration in seconds
 * @param {string} keyPrefix - Optional prefix for the cache key
 */
const cache = (duration, keyPrefix = '') => {
  return async (req, res, next) => {
    // If Redis is not ready, bypass the cache
    if (!redisManager.isReady()) {
      return next();
    }

    try {
      // Make cache key user-specific if user is authenticated
      const userPart = req.user ? `:${req.user.id}` : '';
      const key = `cache:${keyPrefix}${req.originalUrl}${userPart}`;

      const cachedResponse = await redisManager.get(key);

      if (cachedResponse) {
        return res.json(cachedResponse);
      }

      // Override res.json to cache the response body
      const originalJson = res.json;
      res.json = function (body) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redisManager.set(key, body, duration).catch(err => {
            logger.error('Cache set error in middleware:', err);
          });
        }
        originalJson.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next(); // Fail open if cache errors out
    }
  };
};

/**
 * Helper to clear cache based on a pattern
 * @param {string} keyPattern - Pattern to delete (e.g. '/api/v1/feed*')
 */
const clearCache = async (keyPattern) => {
  if (!redisManager.isReady()) return;
  try {
    const keys = await redisManager.client.keys(`cache:*${keyPattern}*`);
    if (keys.length > 0) {
      await redisManager.client.del(...keys);
    }
  } catch (error) {
    logger.error('Cache clear error:', error);
  }
};

module.exports = { cache, clearCache };