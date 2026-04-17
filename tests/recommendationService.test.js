const recommendationService = require('../src/services/recommendationService');
const User = require('../src/models/User');
const Post = require('../src/models/Post');

jest.mock('../src/models/User');
jest.mock('../src/models/Post');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('RecommendationService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── getRecommendedUsers ──────────────────────────────────────────────────
  describe('getRecommendedUsers', () => {
    const userId = 'user_1';

    it('should return empty array if user not found', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      const result = await recommendationService.getRecommendedUsers(userId);
      expect(result).toEqual([]);
    });

    it('should return friends-of-friends when enough exist', async () => {
      const mockUser = { following: ['user_2'], blockedUsers: [] };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      const fofUsers = Array.from({ length: 10 }, (_, i) => ({ _id: `rec_${i}`, username: `rec_${i}` }));
      User.aggregate.mockResolvedValue(fofUsers);

      const result = await recommendationService.getRecommendedUsers(userId, 10);
      expect(result).toHaveLength(10);
      // Since we got enough, popularUsers should not be queried
      expect(User.find).not.toHaveBeenCalled();
    });

    it('should fill with popular users if not enough fof recommendations', async () => {
      const mockUser = { following: ['user_2'], blockedUsers: [] };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      // Only 3 fof recommendations
      User.aggregate.mockResolvedValue([
        { _id: 'rec_1', username: 'rec_1' },
        { _id: 'rec_2', username: 'rec_2' },
        { _id: 'rec_3', username: 'rec_3' }
      ]);

      // 7 popular users to fill the rest
      const popularUsers = Array.from({ length: 7 }, (_, i) => ({
        toObject: () => ({ _id: `pop_${i}`, username: `pop_${i}` })
      }));
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(popularUsers)
      };
      User.find.mockReturnValue(mockQuery);

      const result = await recommendationService.getRecommendedUsers(userId, 10);
      expect(result).toHaveLength(10);
      expect(User.find).toHaveBeenCalled();
    });

    it('should return empty array on error', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('DB error')) });
      const result = await recommendationService.getRecommendedUsers(userId);
      expect(result).toEqual([]);
    });
  });

  // ─── getRecommendedPosts ──────────────────────────────────────────────────
  describe('getRecommendedPosts', () => {
    const userId = 'user_1';

    it('should return posts from followed users and trending posts if not enough', async () => {
      const mockUser = { following: ['user_2'], interests: ['tech'] };
      User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });

      // getUserInteractedPosts returns some IDs
      const interactedPostsQuery = jest.fn().mockResolvedValue([{ _id: 'interacted_1' }]);
      Post.find.mockImplementation((query) => {
        // First call is getUserInteractedPosts
        if (query.$or) return { select: interactedPostsQuery };
        // Second call is getTrendingPosts
        return {
          sort: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          populate: jest.fn().mockResolvedValue([{ _id: 'trending_1' }])
        };
      });

      Post.aggregate.mockResolvedValue([{ _id: 'recommended_1' }]); // 1 post, need 9 more

      const result = await recommendationService.getRecommendedPosts(userId, 10);

      expect(Post.aggregate).toHaveBeenCalled();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array on error', async () => {
      User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('DB error')) });
      const result = await recommendationService.getRecommendedPosts(userId);
      expect(result).toEqual([]);
    });
  });

  // ─── getUserInteractedPosts ───────────────────────────────────────────────
  describe('getUserInteractedPosts', () => {
    it('should return list of post IDs', async () => {
      const mockPosts = [{ _id: 'post_1' }, { _id: 'post_2' }];
      Post.find.mockReturnValue({ select: jest.fn().mockResolvedValue(mockPosts) });

      const result = await recommendationService.getUserInteractedPosts('user_1');
      expect(result).toEqual(['post_1', 'post_2']);
    });
  });

  // ─── getTrendingPosts ─────────────────────────────────────────────────────
  describe('getTrendingPosts', () => {
    it('should return trending posts sorted by likesCount', async () => {
      const mockPosts = [{ _id: 'trending_1', likesCount: 100 }];
      Post.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(mockPosts)
      });

      const result = await recommendationService.getTrendingPosts('user_1', 5);
      expect(result).toEqual(mockPosts);
      expect(Post.find).toHaveBeenCalledWith(expect.objectContaining({
        visibility: 'public',
        moderationStatus: 'approved'
      }));
    });
  });

  // ─── getSimilarContent ────────────────────────────────────────────────────
  describe('getSimilarContent', () => {
    it('should return empty array if post not found', async () => {
      Post.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      const result = await recommendationService.getSimilarContent('post_1');
      expect(result).toEqual([]);
    });

    it('should find posts with matching hashtags', async () => {
      const mockPost = { _id: 'post_1', hashtags: ['#tech', '#js'], author: 'user_1' };
      Post.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(mockPost) });

      const similarPosts = [{ _id: 'similar_1' }];
      Post.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue(similarPosts)
      });

      const result = await recommendationService.getSimilarContent('post_1', 5);

      expect(Post.find).toHaveBeenCalledWith(expect.objectContaining({
        hashtags: { $in: ['#tech', '#js'] },
        visibility: 'public'
      }));
      expect(result).toEqual(similarPosts);
    });

    it('should return empty array on error', async () => {
      Post.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('DB error')) });
      const result = await recommendationService.getSimilarContent('post_1');
      expect(result).toEqual([]);
    });
  });
});
