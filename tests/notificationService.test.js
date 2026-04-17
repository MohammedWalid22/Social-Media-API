const mongoose = require('mongoose');
const NotificationService = require('../src/services/notificationService');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const redis = require('../src/config/redis');
const logger = require('../src/utils/logger');

jest.mock('../src/models/Notification');
jest.mock('../src/models/User');
jest.mock('../src/config/redis', () => ({
  publish: jest.fn().mockResolvedValue(true),
  incrementCounter: jest.fn().mockResolvedValue(true),
  decrementCounter: jest.fn().mockResolvedValue(true),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
}));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('NotificationService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create notification and publish to redis', async () => {
      const mockData = { recipient: 'user_1', type: 'like' };
      const mockNotif = { _id: 'notif_1', ...mockData };
      Notification.create.mockResolvedValue(mockNotif);

      const result = await NotificationService.create(mockData);

      expect(Notification.create).toHaveBeenCalledWith(mockData);
      expect(redis.publish).toHaveBeenCalledWith('notifications:user_1', expect.any(String));
      expect(redis.incrementCounter).toHaveBeenCalledWith('unread:user_1');
      expect(result).toEqual(mockNotif);
    });

    it('should return null if invalid data', async () => {
      const result = await NotificationService.create({ type: 'like' });
      expect(logger.warn).toHaveBeenCalledWith('Invalid notification data:', { type: 'like' });
      expect(result).toBeNull();
    });

    it('should return null and log error if db fails', async () => {
      Notification.create.mockRejectedValue(new Error('DB Error'));
      const result = await NotificationService.create({ recipient: 'user_1', type: 'like' });
      expect(logger.error).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('notifyMentions', () => {
    it('should create mentions for all users', async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockResolvedValue([{ _id: 'user_1' }, { _id: 'user_2' }])
      });
      Notification.insertMany.mockResolvedValue(true);

      await NotificationService.notifyMentions(['foo', 'bar'], 'post_1', 'sender_1');

      expect(User.find).toHaveBeenCalled();
      expect(Notification.insertMany).toHaveBeenCalled();
      expect(redis.publish).toHaveBeenCalledTimes(2);
    });

    it('should silently return if no mentions', async () => {
      await NotificationService.notifyMentions([], 'post_1', 'sender_1');
      expect(User.find).not.toHaveBeenCalled();
    });
  });

  describe('notifyNewMessage and notifyTyping', () => {
    it('should publish message notification', async () => {
      await NotificationService.notifyNewMessage('user_1', { text: 'hi' });
      expect(redis.publish).toHaveBeenCalledWith('messages:user_1', expect.stringContaining('new_message'));
    });

    it('should publish typing notification', async () => {
      await NotificationService.notifyTyping('user_1', 'sender_1', true);
      expect(redis.publish).toHaveBeenCalledWith('typing:user_1', expect.stringContaining('sender_1'));
    });
  });

  describe('markAsRead and markAllAsRead', () => {
    it('should mark single notification as read', async () => {
      Notification.findOneAndUpdate.mockResolvedValue({ read: true });
      const result = await NotificationService.markAsRead('user_1', 'notif_1');
      expect(Notification.findOneAndUpdate).toHaveBeenCalled();
      expect(redis.decrementCounter).toHaveBeenCalledWith('unread:user_1');
      expect(result.read).toBe(true);
    });

    it('should mark all as read', async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 3 });
      const result = await NotificationService.markAllAsRead('user_1');
      expect(Notification.updateMany).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalledWith('unread:user_1', 0, 300);
      expect(result).toBe(3);
    });
  });

  describe('getUnreadCount', () => {
    it('should return cached count if exists', async () => {
      redis.get.mockResolvedValue('5');
      const count = await NotificationService.getUnreadCount('user_1');
      expect(count).toBe(5);
      expect(Notification.countDocuments).not.toHaveBeenCalled();
    });

    it('should query DB and cache if not in redis', async () => {
      redis.get.mockResolvedValue(null);
      Notification.countDocuments.mockResolvedValue(10);
      const count = await NotificationService.getUnreadCount('user_1');
      expect(count).toBe(10);
      expect(redis.set).toHaveBeenCalledWith('unread:user_1', 10, 300);
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: 'notif_1' }])
      };
      Notification.find.mockReturnValue(mockQuery);
      Notification.countDocuments.mockResolvedValue(1);
      redis.get.mockResolvedValue('0'); 

      const result = await NotificationService.getNotifications('user_1', { page: 1, limit: 10 });
      expect(result.notifications).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.unreadCount).toBe(0);
    });
  });

  describe('deleteNotification', () => {
    it('should delete and decrement counter if unread', async () => {
      Notification.findOneAndDelete.mockResolvedValue({ _id: 'notif_1', read: false });
      await NotificationService.deleteNotification('user_1', 'notif_1');
      expect(redis.decrementCounter).toHaveBeenCalled();
    });

    it('should just delete if already read', async () => {
      Notification.findOneAndDelete.mockResolvedValue({ _id: 'notif_1', read: true });
      await NotificationService.deleteNotification('user_1', 'notif_1');
      expect(redis.decrementCounter).not.toHaveBeenCalled();
    });

    it('should throw if not found', async () => {
      Notification.findOneAndDelete.mockResolvedValue(null);
      await expect(NotificationService.deleteNotification('user_1', 'notif_1'))
        .rejects.toThrow('Notification not found');
    });
  });

  describe('groupNotifications', () => {
    it('should return grouped notifications', async () => {
      Notification.aggregate.mockResolvedValue([{ _id: 'group_1', count: 2 }]);
      const result = await NotificationService.groupNotifications(new mongoose.Types.ObjectId().toString());
      expect(Notification.aggregate).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
