const notificationController = require('../src/controllers/notificationController');
const Notification = require('../src/models/Notification');

jest.mock('../src/models/Notification');
jest.mock('../src/middleware/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }
}));

describe('NotificationController Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { _id: 'user_1', notificationPreferences: {}, save: jest.fn().mockResolvedValue(true) },
      params: {},
      body: {},
      query: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  // ─── getNotifications ─────────────────────────────────────────────────────
  describe('getNotifications', () => {
    it('should return paginated notifications and unread count', async () => {
      const mockNotifications = [{ _id: 'n1', read: false }];
      // Build a mock chain where the 3rd populate call resolves the array
      const chain = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      chain.populate
        .mockReturnValueOnce(chain)
        .mockReturnValueOnce(chain)
        .mockResolvedValueOnce(mockNotifications);
      Notification.find.mockReturnValue(chain);
      Notification.countDocuments.mockResolvedValue(3);

      await notificationController.getNotifications(mockReq, mockRes, mockNext);

      expect(Notification.find).toHaveBeenCalledWith({ recipient: 'user_1' });
      expect(Notification.countDocuments).toHaveBeenCalledWith({ recipient: 'user_1', read: false });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ unreadCount: 3 })
      }));
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────
  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockReq.params.id = 'notif_1';
      const updatedNotif = { _id: 'notif_1', read: true };
      Notification.findOneAndUpdate.mockResolvedValue(updatedNotif);

      await notificationController.markAsRead(mockReq, mockRes, mockNext);

      expect(Notification.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'notif_1', recipient: 'user_1' },
        { read: true, readAt: expect.any(Date) },
        { new: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should call next(AppError) if notification not found', async () => {
      mockReq.params.id = 'missing';
      Notification.findOneAndUpdate.mockResolvedValue(null);

      await notificationController.markAsRead(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────
  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      Notification.updateMany.mockResolvedValue({ modifiedCount: 5 });

      await notificationController.markAllAsRead(mockReq, mockRes, mockNext);

      expect(Notification.updateMany).toHaveBeenCalledWith(
        { recipient: 'user_1', read: false },
        { read: true, readAt: expect.any(Date) }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: '5 notifications marked as read'
      }));
    });

    it('should call next on error', async () => {
      Notification.updateMany.mockRejectedValue(new Error('DB error'));
      await notificationController.markAllAsRead(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ─── deleteNotification ───────────────────────────────────────────────────
  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockReq.params.id = 'notif_1';
      Notification.findOneAndDelete.mockResolvedValue({ _id: 'notif_1' });

      await notificationController.deleteNotification(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(204);
    });

    it('should call next(AppError) if notification not found', async () => {
      mockReq.params.id = 'missing';
      Notification.findOneAndDelete.mockResolvedValue(null);

      await notificationController.deleteNotification(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─── updatePreferences ────────────────────────────────────────────────────
  describe('updatePreferences', () => {
    it('should update notification preferences', async () => {
      mockReq.body = { emailNotifications: true, pushNotifications: false, muteTypes: ['like'] };

      await notificationController.updatePreferences(mockReq, mockRes, mockNext);

      expect(mockReq.user.save).toHaveBeenCalled();
      expect(mockReq.user.notificationPreferences).toEqual({
        email: true,
        push: false,
        muteTypes: ['like']
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should default muteTypes to [] if not provided', async () => {
      mockReq.body = { emailNotifications: false, pushNotifications: true };

      await notificationController.updatePreferences(mockReq, mockRes, mockNext);

      expect(mockReq.user.notificationPreferences.muteTypes).toEqual([]);
    });
  });
});
