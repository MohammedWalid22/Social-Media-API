const mongoose = require('mongoose');
const analyticsService = require('../src/services/analyticsService');
const Post = require('../src/models/Post');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');

jest.mock('../src/models/Post');
jest.mock('../src/models/User');
jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
}));

describe('AnalyticsService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserEngagement', () => {
    it('should calculate engagement stats correctly', async () => {
      const mockStats = [{
        totalPosts: 5,
        totalLikes: 100,
        totalComments: 50,
        totalShares: 10,
        avgEngagement: 32,
      }];
      Post.aggregate.mockResolvedValue(mockStats);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ followers: new Array(100) })
      });

      const userId = new mongoose.Types.ObjectId().toString();
      const res = await analyticsService.getUserEngagement(userId, '7d');

      expect(Post.aggregate).toHaveBeenCalled();
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(res.totalPosts).toBe(5);
      expect(res.engagementRate).toBeDefined();
    });

    it('should return default values if no stats found', async () => {
      Post.aggregate.mockResolvedValue([]);
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ followers: [] })
      });

      const userId = new mongoose.Types.ObjectId().toString();
      const res = await analyticsService.getUserEngagement(userId, '1d');

      expect(res.totalPosts).toBe(0);
      expect(res.engagementRate).toBe(0);
    });

    it('should throw and log if error occurs', async () => {
      Post.aggregate.mockRejectedValue(new Error('DB Error'));
      const userId = new mongoose.Types.ObjectId().toString();

      await expect(analyticsService.getUserEngagement(userId, '7d')).rejects.toThrow('DB Error');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw if timeframe is invalid', async () => {
      const userId = new mongoose.Types.ObjectId().toString();
      await expect(analyticsService.getUserEngagement(userId, 'invalid')).rejects.toThrow('Invalid timeframe: invalid');
    });
  });

  describe('getPostAnalytics', () => {
    it('should return post analytics with velocity', async () => {
      const mockPost = {
        likesCount: 100,
        commentsCount: 20,
        sharesCount: 5,
        views: 500,
        createdAt: Date.now() - (1000 * 60 * 60 * 2), // 2 hours ago
        toObject: jest.fn().mockReturnValue({ id: '1' })
      };

      Post.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockPost)
      });

      const res = await analyticsService.getPostAnalytics('post_1');
      expect(res.hoursSincePosted).toBeCloseTo(2, 0);
      expect(res.engagementVelocity).toBeDefined();
      expect(res.engagementVelocity.likesPerHour).toBeGreaterThan(0);
    });

    it('should throw if post not found', async () => {
      Post.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });

      await expect(analyticsService.getPostAnalytics('post_1')).rejects.toThrow('Post not found');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getAudienceDemographics', () => {
    it('should return placeholder object', async () => {
      const res = await analyticsService.getAudienceDemographics();
      expect(res).toHaveProperty('ageGroups');
      expect(res).toHaveProperty('gender');
    });
  });

  describe('parseTimeframe', () => {
    it('should return milliseconds correctly', () => {
      expect(analyticsService.parseTimeframe('1d')).toBe(1 * 24 * 60 * 60 * 1000);
      expect(analyticsService.parseTimeframe('7d')).toBe(7 * 24 * 60 * 60 * 1000);
      expect(analyticsService.parseTimeframe('30d')).toBe(30 * 24 * 60 * 60 * 1000);
      expect(analyticsService.parseTimeframe('90d')).toBe(90 * 24 * 60 * 60 * 1000);
    });

    it('should throw error for unknown timeframe', () => {
      expect(() => analyticsService.parseTimeframe('5d')).toThrow('Invalid timeframe: 5d');
    });
  });
});
