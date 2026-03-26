const { Server } = require('socket.io');
const Redis = require('ioredis');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const authMiddleware = require('../middleware/socketAuth');

class NotificationSocketService {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      path: '/socket.io/notifications',
      cors: {
        origin: '*',
      }
    });

    this.io.use(authMiddleware);

    this.io.on('connection', (socket) => {
      const userId = socket.user._id.toString();
      logger.info(`Notification client connected: ${socket.id}, User: ${userId}`);

      // Join a personal room to receive targeted events
      socket.join(userId);

      // Handle typing status — publish via the dedicated publisher connection
      socket.on('typing', ({ recipientId, isTyping }) => {
        redis.publisher.publish(`typing:${recipientId}`, JSON.stringify({
          type: 'typing-status',
          data: { senderId: userId, isTyping }
        })).catch(err => logger.error('Redis publish error (typing):', err));
      });

      // Broadcast online status to all connected clients
      this.io.emit('user-status', { userId, status: 'online' });

      socket.on('disconnect', () => {
        this.io.emit('user-status', { userId, status: 'offline' });
        logger.info(`Notification client disconnected: ${socket.id}`);
      });
    });

    this.setupRedisBridge();
  }

  setupRedisBridge() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // IMPORTANT: We create a DEDICATED ioredis connection for psubscribe.
    // Reusing the shared redis.subscriber is forbidden here because that client
    // is already in plain subscribe() mode (from notificationService.js),
    // and mixing subscribe() + psubscribe() on the same connection throws:
    //   "Connection in subscriber mode, only subscriber commands may be used"
    this.pSubscriber = new Redis(redisUrl, {
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });

    this.pSubscriber.on('error', (err) => {
      logger.error('NotificationSocketService subscriber error:', err.message);
    });

    this.pSubscriber.psubscribe('notifications:*', 'messages:*', 'typing:*', (err) => {
      if (err) {
        logger.error('Redis psubscribe error:', err);
        return;
      }
      logger.info('✅ NotificationSocketService Redis bridge established');
    });

    this.pSubscriber.on('pmessage', (_pattern, channel, message) => {
      try {
        const payload = JSON.parse(message);
        const userId = channel.split(':')[1];
        this.io.to(userId).emit(payload.type || 'notification', payload.data || payload);
      } catch (err) {
        logger.error('Redis pmessage parse error:', err);
      }
    });
  }
}

module.exports = NotificationSocketService;
