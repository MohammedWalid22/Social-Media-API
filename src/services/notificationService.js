const Notification = require('../models/Notification');
const redis = require('../config/redis');
const logger = require('../utils/logger');

class NotificationService {
  async create(data) {
    try {
      // Validate required fields
      if (!data.recipient || !data.type) {
        logger.warn('Invalid notification data:', data);
        return null;
      }

      const notification = await Notification.create(data);

      // Real-time push via Redis pub/sub
      try {
        await redis.publish(`notifications:${data.recipient}`, JSON.stringify({
          type: 'new_notification',
          data: notification,
        }));
      } catch (redisErr) {
        logger.warn('Redis publish failed:', redisErr);
      }

      // Update unread count in cache
      try {
        await redis.incrementCounter(`unread:${data.recipient}`);
      } catch (redisErr) {
        logger.warn('Redis counter increment failed:', redisErr);
      }

      // Send push notification if enabled (placeholder)
      await this.sendPushNotification(data.recipient, notification);

      return notification;
    } catch (error) {
      logger.error('Notification creation failed:', error);
      return null;
    }
  }

  async notifyMentions(mentions, postId, senderId) {
    try {
      if (!mentions || mentions.length === 0) return;

      const User = require('../models/User');
      const users = await User.find({ 
        username: { $in: mentions },
        accountDeleted: false 
      }).select('_id');

      const notifications = users.map(user => ({
        recipient: user._id,
        sender: senderId,
        type: 'mention',
        post: postId,
      }));

      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
        
        // Publish to Redis for each recipient
        for (const notif of notifications) {
          await redis.publish(`notifications:${notif.recipient}`, JSON.stringify({
            type: 'new_notification',
            data: notif,
          })).catch(() => {});
        }
      }
    } catch (error) {
      logger.error('Mention notification failed:', error);
    }
  }

  async notifyNewMessage(recipientId, data) {
    try {
      await redis.publish(`messages:${recipientId}`, JSON.stringify({
        type: 'new_message',
        data,
      }));
    } catch (error) {
      logger.error('Message notification failed:', error);
    }
  }

  async notifyTyping(recipientId, senderId, isTyping) {
    try {
      await redis.publish(`typing:${recipientId}`, JSON.stringify({
        sender: senderId,
        isTyping,
      }));
    } catch (error) {
      logger.error('Typing notification failed:', error);
    }
  }

  async markAsRead(userId, notificationId) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { read: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        throw new Error('Notification not found');
      }

      await redis.decrementCounter(`unread:${userId}`).catch(() => {});
      
      return notification;
    } catch (error) {
      logger.error('Mark as read failed:', error);
      throw error;
    }
  }

  async markAllAsRead(userId) {
    try {
      const result = await Notification.updateMany(
        { recipient: userId, read: false },
        { read: true, readAt: new Date() }
      );

      await redis.set(`unread:${userId}`, 0, 300).catch(() => {});
      
      return result.modifiedCount;
    } catch (error) {
      logger.error('Mark all as read failed:', error);
      throw error;
    }
  }

  async getUnreadCount(userId) {
    try {
      const cached = await redis.get(`unread:${userId}`);
      if (cached !== null) return parseInt(cached);

      const count = await Notification.countDocuments({
        recipient: userId,
        read: false,
      });

      await redis.set(`unread:${userId}`, count, 300).catch(() => {});
      return count;
    } catch (error) {
      logger.error('Get unread count failed:', error);
      return 0;
    }
  }

  async getNotifications(userId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    try {
      const notifications = await Notification.find({ recipient: userId })
        .sort('-createdAt')
        .skip(skip)
        .limit(parseInt(limit))
        .populate('sender', 'username avatar')
        .populate('post', 'content.text')
        .populate('comment', 'content')
        .lean();

      const total = await Notification.countDocuments({ recipient: userId });
      const unreadCount = await this.getUnreadCount(userId);

      return {
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      };
    } catch (error) {
      logger.error('Get notifications failed:', error);
      throw error;
    }
  }

  async deleteNotification(userId, notificationId) {
    try {
      const result = await Notification.findOneAndDelete({
        _id: notificationId,
        recipient: userId,
      });

      if (!result) {
        throw new Error('Notification not found');
      }

      // Update unread count if notification was unread
      if (!result.read) {
        await redis.decrementCounter(`unread:${userId}`).catch(() => {});
      }

      return true;
    } catch (error) {
      logger.error('Delete notification failed:', error);
      throw error;
    }
  }

  // Placeholder for push notifications
  async sendPushNotification(userId, notification) {
    // TODO: Integrate with Firebase Cloud Messaging or OneSignal
    logger.info(`Push notification to ${userId}: ${notification.type}`);
  }

  // Group similar notifications
  async groupNotifications(userId) {
    try {
      const grouped = await Notification.aggregate([
        { $match: { recipient: mongoose.Types.ObjectId(userId), read: false } },
        {
          $group: {
            _id: { type: '$type', sender: '$sender' },
            count: { $sum: 1 },
            latest: { $max: '$createdAt' },
            notifications: { $push: '$$ROOT' },
          },
        },
        { $sort: { latest: -1 } },
      ]);

      return grouped;
    } catch (error) {
      logger.error('Group notifications failed:', error);
      return [];
    }
  }
}

module.exports = new NotificationService();