const Redis = require('ioredis');
const logger = require('../utils/logger');

class RedisManager {
  constructor() {
    this.client = null;
    this.subscriber = null;
    this.publisher = null;
    this.isConnected = false;

    this.initialize();
  }

  initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      // Main client for operations
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });

      // Separate connections for pub/sub
      this.subscriber = new Redis(redisUrl);
      this.publisher = new Redis(redisUrl);

      this.setupEventHandlers();
    } catch (error) {
      logger.error('Redis initialization failed:', error);
    }
  }

  setupEventHandlers() {
    this.client.on('connect', () => {
      logger.info('✅ Redis Client Connected');
      this.isConnected = true;
    });

    this.client.on('error', (err) => {
      logger.error('❌ Redis Client Error:', err.message);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.subscriber.on('error', (err) => {
      logger.error('Redis Subscriber Error:', err.message);
    });

    this.publisher.on('error', (err) => {
      logger.error('Redis Publisher Error:', err.message);
    });
  }

  // Check if Redis is ready
  isReady() {
    return this.isConnected && this.client.status === 'ready';
  }

  // Caching helpers with fallback
  async get(key) {
    if (!this.isReady()) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    if (!this.isReady()) return false;
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error('Redis set error:', error);
      return false;
    }
  }

  async delete(key) {
    if (!this.isReady()) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error('Redis delete error:', error);
      return false;
    }
  }

  // Pub/Sub for real-time features
  subscribe(channel, callback) {
    if (!this.isReady()) {
      logger.warn('Redis not ready, cannot subscribe');
      return;
    }
    
    this.subscriber.subscribe(channel);
    this.subscriber.on('message', (ch, msg) => {
      if (ch === channel) {
        try {
          callback(JSON.parse(msg));
        } catch (error) {
          logger.error('Redis message parse error:', error);
        }
      }
    });
  }

  async publish(channel, message) {
    if (!this.isReady()) return false;
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Redis publish error:', error);
      return false;
    }
  }

  // Feed caching
  async cacheFeed(userId, feedData, ttl = 300) {
    return await this.set(`feed:${userId}`, feedData, ttl);
  }

  async getCachedFeed(userId) {
    return await this.get(`feed:${userId}`);
  }

  // Session management
  async storeSession(sessionId, data, ttl = 86400) {
    return await this.set(`session:${sessionId}`, data, ttl);
  }

  async getSession(sessionId) {
    return await this.get(`session:${sessionId}`);
  }

  // Rate limiting helper
  async incrementCounter(key, window = 60) {
    if (!this.isReady()) return 0;
    try {
      const multi = this.client.multi();
      multi.incr(key);
      multi.expire(key, window);
      const results = await multi.exec();
      return results[0][1];
    } catch (error) {
      logger.error('Redis increment error:', error);
      return 0;
    }
  }

  async decrementCounter(key) {
    if (!this.isReady()) return 0;
    try {
      const result = await this.client.decr(key);
      return result;
    } catch (error) {
      logger.error('Redis decrement error:', error);
      return 0;
    }
  }

  // Close connections
  async close() {
    await this.client.quit();
    await this.subscriber.quit();
    await this.publisher.quit();
    logger.info('Redis connections closed');
  }
}

// Export singleton instance
module.exports = new RedisManager();