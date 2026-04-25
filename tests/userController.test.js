const userController = require('../src/controllers/userController');
const User = require('../src/models/User');
const Post = require('../src/models/Post');

const cloudinary = require('../src/config/cloudinary');
const NotificationService = require('../src/services/notificationService');
const AuditLog = require('../src/models/AuditLog');

jest.mock('../src/models/User');
jest.mock('../src/models/Post');
jest.mock('../src/models/FollowRequest');
jest.mock('../src/models/AuditLog');
jest.mock('../src/middleware/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }
}));
jest.mock('../src/config/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn()
    }
  }
}));
jest.mock('../src/services/notificationService');

describe('UserController Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      user: { _id: 'current_user_id', following: [], blockedUsers: [], followers: [], save: jest.fn().mockResolvedValue(true) },
      params: {},
      body: {},
      query: {},
      file: undefined,
      ip: '127.0.0.1'
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('getMe', () => {
    it('should return current user with populated fields', async () => {
      const mockUser = { username: 'testuser' };
      const populateMock = jest.fn().mockReturnThis();
      User.findById.mockReturnValue({
        populate: populateMock,
      });
      populateMock.mockReturnValueOnce({
        populate: jest.fn().mockResolvedValue(mockUser)
      });

      await userController.getMe(mockReq, mockRes, mockNext);

      expect(User.findById).toHaveBeenCalledWith('current_user_id');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ data: { user: mockUser } }));
    });
  });

  describe('updateMe', () => {
    it('should update user fields', async () => {
      mockReq.body = { displayName: 'New Name' };
      User.findByIdAndUpdate.mockResolvedValue({ displayName: 'New Name' });

      await userController.updateMe(mockReq, mockRes, mockNext);

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'current_user_id',
        { displayName: 'New Name' },
        { new: true, runValidators: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('uploadAvatar', () => {
    it('should return 400 if no file', async () => {
      await userController.uploadAvatar(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should upload to cloudinary and update avatar', async () => {
      mockReq.file = { path: 'temp/path.png' };
      cloudinary.cloudinary.uploader.upload.mockResolvedValue({
        secure_url: 'http://example.com/avatar.png',
        public_id: 'avatar_public_id'
      });

      const mockUser = { avatar: {}, save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(mockUser);

      await userController.uploadAvatar(mockReq, mockRes, mockNext);

      expect(cloudinary.cloudinary.uploader.upload).toHaveBeenCalled();
      expect(mockUser.avatar.url).toBe('http://example.com/avatar.png');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getUserProfile', () => {
    it('should return 404 if user not found', async () => {
      mockReq.params.username = 'unknown';
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

      await userController.getUserProfile(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    it('should return user profile and public posts', async () => {
      mockReq.params.username = 'targetuser';
      const mockUser = {
        _id: 'target_id',
        followers: [],
        privacySettings: { profileVisibility: 'public' },
        toObject: jest.fn().mockReturnValue({})
      };
      // For user lookup
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      // For posts lookup
      const postQueryMock = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(['post1', 'post2'])
      };
      Post.find.mockReturnValue(postQueryMock);

      await userController.getUserProfile(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
      }));
    });

    it('should return 403 if profile is private and not following', async () => {
      mockReq.params.username = 'targetuser';
      const mockUser = {
        _id: 'target_id',
        followers: [],
        privacySettings: { profileVisibility: 'private' }
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await userController.getUserProfile(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
  });

  describe('followUser', () => {
    it('should not allow following oneself', async () => {
      mockReq.params.userId = 'current_user_id';
      await userController.followUser(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should return 404 if target user not found', async () => {
      mockReq.params.userId = 'target_id';
      User.findById.mockResolvedValue(null);
      await userController.followUser(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });

    it('should unfollow if already following', async () => {
      mockReq.params.userId = 'target_id';
      const targetUser = {
        _id: 'target_id',
        followers: ['current_user_id'],
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(targetUser);

      await userController.followUser(mockReq, mockRes, mockNext);

      expect(targetUser.followers).not.toContain('current_user_id');
      expect(mockReq.user.following).not.toContain('target_id');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        data: { following: false, followersCount: 0 }
      }));
    });

    it('should send a follow request and notification', async () => {
      mockReq.params.userId = 'target_id';
      const targetUser = {
        _id: 'target_id',
        followers: [],
        privacySettings: { profileVisibility: 'public' },
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(targetUser);
      NotificationService.create.mockResolvedValue(true);

      await userController.followUser(mockReq, mockRes, mockNext);

      expect(NotificationService.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        data: { requested: true }
      }));
    });
  });

  describe('searchUsers', () => {
    it('should return 400 if query is too short', async () => {
      mockReq.query.q = 'a';
      await userController.searchUsers(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should perform text search and return users', async () => {
      mockReq.query.q = 'test';
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([{ username: 'testuser' }])
      };
      User.find.mockReturnValue(mockQuery);

      await userController.searchUsers(mockReq, mockRes, mockNext);

      expect(User.find).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  describe('blockUser', () => {
    it('should unblock if already blocked', async () => {
      mockReq.params.userId = 'target_id';
      mockReq.user.blockedUsers = ['target_id'];

      await userController.blockUser(mockReq, mockRes, mockNext);

      expect(mockReq.user.blockedUsers).not.toContain('target_id');
      expect(mockReq.user.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should block user and remove them from followers/following', async () => {
      mockReq.params.userId = 'target_id';
      User.findByIdAndUpdate.mockResolvedValue(true);

      await userController.blockUser(mockReq, mockRes, mockNext);

      expect(mockReq.user.blockedUsers).toContain('target_id');
      expect(User.findByIdAndUpdate).toHaveBeenCalled();
      expect(mockReq.user.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
  
  describe('deleteAccount', () => {
    it('should return 401 if incorrect password', async () => {
      mockReq.body.password = 'wrong_password';
      const mockUser = { comparePassword: jest.fn().mockResolvedValue(false) };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await userController.deleteAccount(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should schedule account deletion and wipe data if password is correct', async () => {
      mockReq.body.password = 'correct_password';
      const mockUser = { 
        _id: 'user_1',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      await userController.deleteAccount(mockReq, mockRes, mockNext);

      expect(mockUser.accountDeleted).toBe(true);
      expect(mockUser.email).toContain('deleted');
      expect(mockUser.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalled();
      expect(mockRes.cookie).toHaveBeenCalledWith('jwt', 'loggedout', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
