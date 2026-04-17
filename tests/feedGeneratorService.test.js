const feedGeneratorService = require('../src/services/feedGeneratorService');
const Post = require('../src/models/Post');
const User = require('../src/models/User');
const redis = require('../src/config/redis');

jest.mock('../src/models/Post');
jest.mock('../src/models/User');
jest.mock('../src/config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn()
}));
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('FeedGeneratorService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePersonalizedFeed', () => {
    const userId = 'user_1';
    const mockUser = {
      _id: 'user_1',
      following: ['user_2', 'user_3'],
      blockedUsers: ['blocked_1'],
      interests: ['tech']
    };

    it('should return cached result if available on first page', async () => {
      const cachedFeed = { posts: [{ _id: 'post_1' }], nextCursor: null, total: 1 };
      redis.get.mockResolvedValue(cachedFeed);

      const result = await feedGeneratorService.generatePersonalizedFeed(userId);

      expect(redis.get).toHaveBeenCalledWith('feed:user_1:all:initial');
      expect(result).toEqual(cachedFeed);
      // DB should NOT be queried when cache hit
      expect(User.findById).not.toHaveBeenCalled();
    });

    it('should query DB and cache result when no cache exists', async () => {
      redis.get.mockResolvedValue(null);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const mockPosts = Array.from({ length: 5 }, (_, i) => ({
        _id: `post_${i}`,
        createdAt: new Date(`2024-01-0${i + 1}`)
      }));

      Post.aggregate.mockReturnValue({
        allowDiskUse: jest.fn().mockResolvedValue(mockPosts)
      });

      const result = await feedGeneratorService.generatePersonalizedFeed(userId, { limit: 20 });

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(Post.aggregate).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled(); // results should be cached
      expect(result.posts).toHaveLength(5);
      expect(result.nextCursor).toBeNull(); // less than limit, so no next cursor
    });

    it('should paginate: provide nextCursor when posts.length === limit', async () => {
      redis.get.mockResolvedValue(null);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      // Return exactly limit posts to simulate there are more (controller checks posts.length === limit)
      const mockPosts = Array.from({ length: 20 }, (_, i) => ({
        _id: `post_${i}`,
        createdAt: new Date(Date.now() - i * 1000)
      }));

      Post.aggregate.mockReturnValue({
        allowDiskUse: jest.fn().mockResolvedValue(mockPosts)
      });

      const result = await feedGeneratorService.generatePersonalizedFeed(userId, { limit: 20 });

      expect(result.nextCursor).not.toBeNull();
      expect(result.posts).toHaveLength(20);
    });

    it('should skip cache and NOT cache result when cursor is provided', async () => {
      const cursor = new Date().toISOString();
      redis.get.mockResolvedValue(null);
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      Post.aggregate.mockReturnValue({
        allowDiskUse: jest.fn().mockResolvedValue([])
      });

      await feedGeneratorService.generatePersonalizedFeed(userId, { cursor });

      // When cursor is set, we should NOT write to cache
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('should throw error on failure', async () => {
      redis.get.mockResolvedValue(null);
      User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('DB error')) });

      await expect(feedGeneratorService.generatePersonalizedFeed(userId)).rejects.toThrow('DB error');
    });
  });

  describe('buildFeedPipeline', () => {
    const mockUser = { following: ['user_2'], blockedUsers: ['blocked_user'] };

    it('should build pipeline with cursor pagination stage when cursor provided', () => {
      const cursor = new Date().toISOString();
      const pipeline = feedGeneratorService.buildFeedPipeline('user_1', mockUser, cursor, 'all', 20);

      // Find match stage
      const matchStage = pipeline[0];
      const matchConditions = matchStage.$match.$and;

      // cursor filter should be present
      const hasCursorFilter = matchConditions.some(c => c.createdAt?.$lt);
      expect(hasCursorFilter).toBe(true);
    });

    it('should add following filter when filter=following', () => {
      const pipeline = feedGeneratorService.buildFeedPipeline('user_1', mockUser, null, 'following', 20);
      const matchStage = pipeline[0];
      const matchConditions = matchStage.$match.$and;

      const hasFollowingFilter = matchConditions.some(c => c.author?.$in);
      expect(hasFollowingFilter).toBe(true);
    });

    it('should NOT add following filter when filter=all', () => {
      const pipeline = feedGeneratorService.buildFeedPipeline('user_1', mockUser, null, 'all', 20);
      const matchStage = pipeline[0];
      const matchConditions = matchStage.$match.$and;

      // count author.$in – one is from visibility rules, not following filter
      const followingFilters = matchConditions.filter(c => c.author?.$in);
      // 0 explicit author.$in from the filter=following path
      expect(followingFilters).toHaveLength(0);
    });

    it('should exclude blocked users from match', () => {
      const pipeline = feedGeneratorService.buildFeedPipeline('user_1', mockUser, null, 'all', 20);
      const matchStage = pipeline[0];
      const matchConditions = matchStage.$match.$and;

      const blockFilter = matchConditions.find(c => c.author?.$nin);
      expect(blockFilter).toBeDefined();
      expect(blockFilter.author.$nin).toContain('blocked_user');
    });
  });

  describe('getReactionExpression', () => {
    it('should return a $let expression for checking reactions', () => {
      const expr = feedGeneratorService.getReactionExpression('user_1');
      expect(expr).toHaveProperty('$let');
      expect(expr.$let.in.$switch.branches).toHaveLength(4);
    });
  });

  describe('invalidateCache', () => {
    it('should delete feed cache keys for a user', async () => {
      await feedGeneratorService.invalidateCache('user_1');
      expect(redis.delete).toHaveBeenCalledWith('feed:user_1:all:initial');
      expect(redis.delete).toHaveBeenCalledWith('feed:user_1:following:initial');
    });
  });
});
