const adminController = require('../src/controllers/adminController');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const AuditLog = require('../src/models/AuditLog');

jest.mock('../src/models/User');
jest.mock('../src/models/Post');
jest.mock('../src/models/Comment');
jest.mock('../src/models/AuditLog');
jest.mock('../src/middleware/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }
}));

describe('AdminController Unit Tests', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { _id: 'admin_1', role: 'admin' },
      body: {},
      params: {},
      query: {},
      ip: '127.0.0.1'
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
  });

  // ─── getDashboardStats ────────────────────────────────────────────────────
  describe('getDashboardStats', () => {
    it('should return aggregated dashboard statistics', async () => {
      User.countDocuments.mockResolvedValue(100);
      Post.countDocuments.mockResolvedValue(500);
      Comment.countDocuments.mockResolvedValue(50);
      Post.aggregate.mockResolvedValue([{ _id: null, totalLikes: 1200 }]);

      await adminController.getDashboardStats(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        data: expect.objectContaining({
          stats: expect.objectContaining({ totalLikes: 1200 })
        })
      }));
    });

    it('should handle no likes gracefully', async () => {
      User.countDocuments.mockResolvedValue(0);
      Post.countDocuments.mockResolvedValue(0);
      Comment.countDocuments.mockResolvedValue(0);
      Post.aggregate.mockResolvedValue([]); // empty result

      await adminController.getDashboardStats(mockReq, mockRes, mockNext);

      const data = mockRes.json.mock.calls[0][0].data.stats;
      expect(data.totalLikes).toBe(0);
    });

    it('should call next on error', async () => {
      User.countDocuments.mockRejectedValue(new Error('DB error'));
      await adminController.getDashboardStats(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  // ─── getFlaggedContent ────────────────────────────────────────────────────
  describe('getFlaggedContent', () => {
    const mockQuery = (data) => ({
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(data)
    });

    it('should return flagged posts and comments when type=all', async () => {
      Post.find.mockReturnValue(mockQuery([{ _id: 'p1' }]));
      Comment.find.mockReturnValue(mockQuery([{ _id: 'c1' }]));

      await adminController.getFlaggedContent(mockReq, mockRes, mockNext);

      expect(Post.find).toHaveBeenCalledWith({ moderationStatus: 'flagged' });
      expect(Comment.find).toHaveBeenCalledWith({ moderationStatus: 'rejected' });
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return only posts when type=posts', async () => {
      mockReq.query.type = 'posts';
      Post.find.mockReturnValue(mockQuery([{ _id: 'p1' }]));

      await adminController.getFlaggedContent(mockReq, mockRes, mockNext);

      expect(Post.find).toHaveBeenCalled();
      expect(Comment.find).not.toHaveBeenCalled();
    });

    it('should return only comments when type=comments', async () => {
      mockReq.query.type = 'comments';
      Comment.find.mockReturnValue(mockQuery([{ _id: 'c1' }]));

      await adminController.getFlaggedContent(mockReq, mockRes, mockNext);

      expect(Comment.find).toHaveBeenCalled();
      expect(Post.find).not.toHaveBeenCalled();
    });
  });

  // ─── moderateContent ──────────────────────────────────────────────────────
  describe('moderateContent', () => {
    it('should approve a post and create audit log', async () => {
      mockReq.body = { contentId: 'post_1', contentType: 'post', action: 'approve', reason: 'looks good' };
      Post.findByIdAndUpdate.mockResolvedValue({ _id: 'post_1', moderationStatus: 'approved' });
      AuditLog.create.mockResolvedValue(true);

      await adminController.moderateContent(mockReq, mockRes, mockNext);

      expect(Post.findByIdAndUpdate).toHaveBeenCalledWith(
        'post_1',
        expect.objectContaining({ moderationStatus: 'approved' }),
        { new: true }
      );
      expect(AuditLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should call next(AppError) if content not found', async () => {
      mockReq.body = { contentId: 'missing', contentType: 'comment', action: 'reject' };
      Comment.findByIdAndUpdate.mockResolvedValue(null);

      await adminController.moderateContent(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ─── getAuditLogs ─────────────────────────────────────────────────────────
  describe('getAuditLogs', () => {
    it('should return audit logs with pagination', async () => {
      mockReq.query = { page: '1', limit: '10', userId: 'user_1' };
      AuditLog.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([{ _id: 'log_1' }])
      });
      AuditLog.countDocuments.mockResolvedValue(1);

      await adminController.getAuditLogs(mockReq, mockRes, mockNext);

      expect(AuditLog.find).toHaveBeenCalledWith(expect.objectContaining({ user: 'user_1' }));
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });
  });

  // ─── getUsers ─────────────────────────────────────────────────────────────
  describe('getUsers', () => {
    it('should return users with no filter', async () => {
      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ username: 'testuser' }])
      });
      User.countDocuments.mockResolvedValue(1);

      await adminController.getUsers(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });

    it('should apply search filter when provided', async () => {
      mockReq.query.search = 'john';
      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      User.countDocuments.mockResolvedValue(0);

      await adminController.getUsers(mockReq, mockRes, mockNext);

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ $or: expect.any(Array) }));
    });

    it('should apply status=deleted filter', async () => {
      mockReq.query.status = 'deleted';
      User.find.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([])
      });
      User.countDocuments.mockResolvedValue(0);

      await adminController.getUsers(mockReq, mockRes, mockNext);

      expect(User.find).toHaveBeenCalledWith(expect.objectContaining({ accountDeleted: true }));
    });
  });

  // ─── suspendUser ──────────────────────────────────────────────────────────
  describe('suspendUser', () => {
    it('should suspend a user and log the action', async () => {
      mockReq.params.userId = 'target_user';
      mockReq.body = { reason: 'Violating terms', duration: 86400000 };
      User.findByIdAndUpdate.mockResolvedValue({ _id: 'target_user', suspended: true });
      AuditLog.create.mockResolvedValue(true);

      await adminController.suspendUser(mockReq, mockRes, mockNext);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'target_user',
        expect.objectContaining({ suspended: true }),
        { new: true }
      );
      expect(AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        action: 'USER_SUSPENSION'
      }));
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should call next(AppError) if user not found', async () => {
      mockReq.params.userId = 'missing_user';
      User.findByIdAndUpdate.mockResolvedValue(null);

      await adminController.suspendUser(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
