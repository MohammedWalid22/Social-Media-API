const commentController = require('../src/controllers/commentController');
const Comment = require('../src/models/Comment');
const AudioComment = require('../src/models/AudioComment');
const Post = require('../src/models/Post');
const Sticker = require('../src/models/Sticker');
const GamificationService = require('../src/services/gamificationService');
const NotificationService = require('../src/services/notificationService');
const AudioProcessingService = require('../src/services/audioProcessingService');
const AudioModerationService = require('../src/services/audioModerationService');
const cloudinary = require('../src/config/cloudinary');

jest.mock('../src/models/Comment');
jest.mock('../src/models/AudioComment');
jest.mock('../src/models/Post');
jest.mock('../src/models/Sticker');
jest.mock('../src/models/AuditLog');
jest.mock('../src/services/gamificationService');
jest.mock('../src/services/notificationService');
jest.mock('../src/services/audioProcessingService');
jest.mock('../src/services/audioModerationService');
jest.mock('../src/middleware/errorHandler', () => ({
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
    }
  }
}));
jest.mock('../src/config/cloudinary', () => ({
  uploader: {
    upload: jest.fn(),
    destroy: jest.fn()
  }
}));
jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(true)
}));

describe('CommentController Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      params: { postId: 'post_1', commentId: 'comment_1' },
      body: {},
      query: {},
      user: { _id: 'user_1', role: 'user' },
      file: undefined
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();

    GamificationService.addPoints.mockResolvedValue(true);
    NotificationService.create.mockResolvedValue(true);
  });

  // ─── createComment ────────────────────────────────────────────────────────
  describe('createComment', () => {
    it('should return 404 if post not found', async () => {
      Post.findById.mockResolvedValue(null);
      await commentController.createComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should create text comment and notify post author', async () => {
      mockReq.body = { content: 'Nice post!' };
      const mockPost = {
        _id: 'post_1',
        author: 'user_2', // different from req.user._id → triggers notification
        comments: [],
        commentsCount: 0,
        save: jest.fn()
      };
      const mockComment = {
        _id: 'comment_1',
        populate: jest.fn().mockResolvedValue(true)
      };

      Post.findById.mockResolvedValue(mockPost);
      Comment.create.mockResolvedValue(mockComment);

      await commentController.createComment(mockReq, mockRes, mockNext);

      expect(Comment.create).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Nice post!',
        contentType: 'text'
      }));
      expect(mockPost.commentsCount).toBe(1);
      expect(mockPost.save).toHaveBeenCalled();
      expect(NotificationService.create).toHaveBeenCalled();
      expect(GamificationService.addPoints).toHaveBeenCalledWith('user_1', 5);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  // ─── createStickerComment ─────────────────────────────────────────────────
  describe('createStickerComment', () => {
    it('should return 400 if stickerId is missing', async () => {
      await commentController.createStickerComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if post not found', async () => {
      mockReq.body = { stickerId: 'sticker_1' };
      Post.findById.mockResolvedValue(null);
      await commentController.createStickerComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 404 if sticker not found or inactive', async () => {
      mockReq.body = { stickerId: 'sticker_1' };
      Post.findById.mockResolvedValue({ _id: 'post_1', author: 'user_2', comments: [], save: jest.fn() });
      Sticker.findById.mockResolvedValue(null);
      await commentController.createStickerComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if sticker is offensive', async () => {
      mockReq.body = { stickerId: 'sticker_1' };
      const mockPost = { _id: 'post_1', author: 'user_2', comments: [], commentsCount: 0, save: jest.fn() };
      const mockSticker = { _id: 'sticker_1', isActive: true, isOffensive: true, name: 'Bad Sticker' };
      const mockComment = { _id: 'com_1' };

      Post.findById.mockResolvedValue(mockPost);
      Sticker.findById.mockResolvedValue(mockSticker);
      Comment.create.mockResolvedValue(mockComment);

      await commentController.createStickerComment(mockReq, mockRes, mockNext);

      // Controller returns 400 (not 403) when sticker is offensive
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'This sticker has been flagged as inappropriate and cannot be used.'
      }));
    });

    it('should create sticker comment if sticker is not offensive', async () => {
      mockReq.body = { stickerId: 'sticker_1' };
      const mockPost = {
        _id: 'post_1',
        author: 'user_1', // Same user → no notification
        comments: [],
        commentsCount: 0,
        save: jest.fn()
      };
      const mockSticker = { _id: 'sticker_1', isActive: true, isOffensive: false, name: 'Cool Sticker' };
      const mockComment = {
        _id: 'com_1',
        populate: jest.fn().mockResolvedValue(true)
      };

      Post.findById.mockResolvedValue(mockPost);
      Sticker.findById.mockResolvedValue(mockSticker);
      Comment.create.mockResolvedValue(mockComment);
      Sticker.findByIdAndUpdate.mockResolvedValue(true);

      await commentController.createStickerComment(mockReq, mockRes, mockNext);

      expect(mockPost.save).toHaveBeenCalled();
      expect(mockPost.commentsCount).toBe(1);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  // ─── createAudioComment ───────────────────────────────────────────────────
  describe('createAudioComment', () => {
    it('should return 400 if no audio file uploaded', async () => {
      await commentController.createAudioComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if post not found', async () => {
      mockReq.file = { path: 'path/to/audio.mp3', size: 1024 };
      AudioProcessingService.getAudioMetadata.mockResolvedValue({ duration: 30 });
      Post.findById.mockResolvedValue(null);
      await commentController.createAudioComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if audio is too long (> 300s)', async () => {
      mockReq.file = { path: 'path/to/audio.mp3', size: 1024 };
      AudioProcessingService.getAudioMetadata.mockResolvedValue({ duration: 400 });
      Post.findById.mockResolvedValue({ _id: 'post_1' });
      await commentController.createAudioComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Audio comment must be less than 5 minutes'
      }));
    });

    it('should process audio and create comment successfully', async () => {
      mockReq.file = { path: 'path/to/audio.mp3', size: 1024 };
      const mockPost = {
        _id: 'post_1',
        author: 'user_2',
        comments: [],
        commentsCount: 0,
        save: jest.fn().mockResolvedValue(true),
        toString: () => 'user_2'
      };

      AudioProcessingService.getAudioMetadata.mockResolvedValue({ duration: 30 });
      Post.findById.mockResolvedValue(mockPost);

      const audioData = {
        url: 'http://cloudinary.example.com/audio.mp3',
        publicId: 'audio_pub_id',
        duration: 30,
        format: 'mp3',
        size: 1024,
        bitrate: 128,
        waveformData: [],
        variants: []
      };
      AudioProcessingService.processAudio.mockResolvedValue(audioData);

      const mockAudioComment = {
        _id: 'audio_com_1',
        formattedDuration: '0:30',
        toObject: jest.fn().mockReturnValue({ _id: 'audio_com_1', duration: 30 })
      };
      AudioComment.create.mockResolvedValue(mockAudioComment);

      const mockComment = {
        _id: 'com_1',
        audioComment: null,
        save: jest.fn().mockResolvedValue(true),
        populate: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({ _id: 'com_1' })
      };
      Comment.create.mockResolvedValue(mockComment);

      // processTranscriptionAsync runs async in background – mock it so it doesn't throw
      AudioProcessingService.transcribeAudio = jest.fn().mockResolvedValue({ text: 'hello', processed: true });
      AudioModerationService.moderateAudio = jest.fn().mockResolvedValue({ status: 'approved' });
      AudioProcessingService.analyzeVoice = jest.fn().mockResolvedValue({});
      AudioComment.findByIdAndUpdate = jest.fn().mockResolvedValue(true);

      await commentController.createAudioComment(mockReq, mockRes, mockNext);

      expect(AudioProcessingService.processAudio).toHaveBeenCalled();
      expect(Comment.create).toHaveBeenCalledWith(expect.objectContaining({ contentType: 'audio' }));
      expect(AudioComment.create).toHaveBeenCalled();
      expect(mockPost.commentsCount).toBe(1);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });
  });

  // ─── getComments ──────────────────────────────────────────────────────────
  describe('getComments', () => {
    it('should retrieve comments for a post', async () => {
      const mockComments = [{
        toObject: () => ({ _id: 'c1', content: 'test', audioComment: null })
      }];

      const queryMock = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
      };
      // Last populate call resolves with the comments
      queryMock.populate
        .mockReturnValueOnce(queryMock)
        .mockReturnValueOnce(queryMock)
        .mockResolvedValueOnce(mockComments);

      Comment.find.mockReturnValue(queryMock);

      await commentController.getComments(mockReq, mockRes, mockNext);

      expect(Comment.find).toHaveBeenCalledWith(expect.objectContaining({
        post: 'post_1',
        parentComment: null
      }));
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });

  // ─── deleteComment ────────────────────────────────────────────────────────
  describe('deleteComment', () => {
    it('should return 404 if comment not found', async () => {
      Comment.findById.mockResolvedValue(null);
      await commentController.deleteComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should return 403 if user is not authorized', async () => {
      const mockComment = {
        _id: 'comment_1',
        author: { toString: () => 'other_user' },
        post: 'post_1',
        audioComment: null
      };
      const mockPost = {
        author: { toString: () => 'post_owner' }
      };

      Comment.findById.mockResolvedValue(mockComment);
      Post.findById.mockResolvedValue(mockPost);

      await commentController.deleteComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should delete comment (soft-delete) and clean up audio if authorized', async () => {
      const mockAudioComment = {
        audio: { publicId: 'audio_pub' },
        save: jest.fn().mockResolvedValue(true)
      };
      const mockPost = {
        author: { toString: () => 'user_1' }, // post owner is req.user → authorized
        commentsCount: 1,
        save: jest.fn().mockResolvedValue(true)
      };
      const mockComment = {
        _id: 'comment_1',
        author: { toString: () => 'other_user' },
        post: 'post_1',
        audioComment: 'audio_com_1',
        contentType: 'audio',
        save: jest.fn().mockResolvedValue(true)
      };

      Comment.findById.mockResolvedValue(mockComment);
      Post.findById.mockResolvedValue(mockPost);
      AudioComment.findById.mockResolvedValue(mockAudioComment);
      cloudinary.uploader.destroy.mockResolvedValue(true);

      await commentController.deleteComment(mockReq, mockRes, mockNext);

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('audio_pub', { resource_type: 'video' });
      expect(mockAudioComment.save).toHaveBeenCalled();
      expect(mockComment.save).toHaveBeenCalled();
      expect(mockPost.commentsCount).toBe(0);
      expect(mockPost.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(204);
    });
  });

  // ─── reactToComment ───────────────────────────────────────────────────────
  describe('reactToComment', () => {
    it('should return 400 for invalid reaction type', async () => {
      mockReq.body = { reaction: 'poop' };
      await commentController.reactToComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should return 404 if comment not found', async () => {
      mockReq.body = { reaction: 'like' };
      Comment.findById.mockResolvedValue(null);
      await commentController.reactToComment(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should add a new reaction and award gamification points', async () => {
      mockReq.body = { reaction: 'like' };
      const mockComment = {
        _id: 'comment_1',
        reactions: { like: [], love: [], laugh: [], angry: [], sad: [] },
        reactionsCount: 0,
        save: jest.fn().mockResolvedValue(true),
        author: 'user_2',
        post: 'post_1'
      };
      Comment.findById.mockResolvedValue(mockComment);

      await commentController.reactToComment(mockReq, mockRes, mockNext);

      expect(mockComment.reactions.like).toContain('user_1');
      expect(mockComment.reactionsCount).toBe(1);
      expect(mockComment.save).toHaveBeenCalled();
      expect(GamificationService.addPoints).toHaveBeenCalledWith('user_1', 1);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should toggle off reaction if same reaction is clicked again', async () => {
      mockReq.body = { reaction: 'like' };
      const mockComment = {
        _id: 'comment_1',
        reactions: { like: ['user_1'], love: [], laugh: [], angry: [], sad: [] },
        reactionsCount: 1,
        save: jest.fn().mockResolvedValue(true),
        author: 'user_2',
        post: 'post_1'
      };
      Comment.findById.mockResolvedValue(mockComment);

      await commentController.reactToComment(mockReq, mockRes, mockNext);

      expect(mockComment.reactions.like).not.toContain('user_1');
      expect(mockComment.reactionsCount).toBe(0);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ reaction: null })
      }));
    });
  });
});
