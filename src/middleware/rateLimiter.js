const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const logger = require('../utils/logger');

// Create Redis client with error handling
let redisClient;
try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
  });
  
  redisClient.on('error', (err) => {
    logger.error('Redis error in rate limiter:', err);
  });
} catch (err) {
  logger.warn('Redis not available for rate limiting, using memory store');
}

// Helper to create limiter with fallback
const createLimiter = (options) => {
  const config = {
    windowMs: options.windowMs,
    max: options.max,
    message: {
      status: 'fail',
      message: options.message || 'Too many requests, please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting entirely in test environment
      if (process.env.NODE_ENV === 'test') return true;
      return req.path === '/health' || req.path === '/api/v1/health';
    },
    handler: (req, res, next, options) => {
      logger.warn(`Rate limit exceeded for ${req.ip} on ${req.path}`);
      res.status(options.statusCode).json(options.message);
    },
  };

  // Use Redis if available, otherwise memory store
  if (redisClient && !redisClient.status === 'end') {
    config.store = new RedisStore({
      client: redisClient,
      prefix: options.prefix || 'rl:',
    });
  }

  return rateLimit(config);
};

const limiters = {
  // Strict for authentication
  auth: createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
    skipSuccessfulRequests: true,
    prefix: 'rl:auth:',
  }),

  // Medium for API general
  api: createLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests from this IP.',
    prefix: 'rl:api:',
  }),

  // Strict for posting (per user)
  post: createLimiter({
    windowMs: 60 * 1000,
    max: 10,
    message: 'Too many posts. Please slow down.',
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    prefix: 'rl:post:',
  }),

  // Very strict for sensitive operations
  sensitive: createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: 'Too many sensitive operations. Please try again later.',
    keyGenerator: (req) => req.user?._id?.toString() || req.ip,
    prefix: 'rl:sensitive:',
  }),
};

module.exports = limiters;