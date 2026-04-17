const searchService = require('../src/services/searchService');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const logger = require('../src/utils/logger');

jest.mock('../src/models/User');
jest.mock('../src/models/Post');
jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
}));

describe('SearchService Unit Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('search', () => {
    it('should search all when type is all', async () => {
      // Mock searches
      const userMock = [{ username: 'testuser' }];
      const postMock = [{ content: 'testpost' }];
      const hashMock = [{ hashtag: 'testhash' }];

      jest.spyOn(searchService, 'searchUsers').mockResolvedValue(userMock);
      jest.spyOn(searchService, 'searchPosts').mockResolvedValue(postMock);
      jest.spyOn(searchService, 'searchHashtags').mockResolvedValue(hashMock);

      const result = await searchService.search('test', 'all', { page: 1, limit: 10 });
      
      expect(searchService.searchUsers).toHaveBeenCalledWith('test', { skip: 0, limit: 10 });
      expect(searchService.searchPosts).toHaveBeenCalledWith('test', { skip: 0, limit: 10 });
      expect(searchService.searchHashtags).toHaveBeenCalledWith('test', { limit: 10 });
      expect(result).toEqual({ users: userMock, posts: postMock, hashtags: hashMock });
    });

    it('should throw and log on error', async () => {
      jest.spyOn(searchService, 'searchUsers').mockRejectedValue(new Error('Search Error'));
      await expect(searchService.search('test')).rejects.toThrow('Search Error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('searchUsers', () => {
    it('should run correct mongoose query for users', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([{ username: 'foo' }])
      };
      User.find.mockReturnValue(mockQuery);

      const res = await searchService.searchUsers('query', { skip: 0, limit: 10 });
      expect(User.find).toHaveBeenCalled();
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(res).toEqual([{ username: 'foo' }]);
    });
  });

  describe('searchPosts', () => {
    it('should run correct mongoose query for posts', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([{ content: 'foo' }])
      };
      Post.find.mockReturnValue(mockQuery);

      const res = await searchService.searchPosts('query', { skip: 0, limit: 10 });
      expect(Post.find).toHaveBeenCalled();
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(10);
      expect(res).toEqual([{ content: 'foo' }]);
    });
  });

  describe('searchHashtags', () => {
    it('should aggregate hashtags correctly', async () => {
      Post.aggregate.mockResolvedValue([{ hashtag: 'test', count: 5 }]);
      const res = await searchService.searchHashtags('#test', { limit: 10 });
      expect(Post.aggregate).toHaveBeenCalled();
      expect(res).toEqual([{ hashtag: 'test', count: 5 }]);
    });
  });

  describe('searchByHashtag', () => {
    it('should query posts by hashtag', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockResolvedValue([{ content: 'post with test' }])
      };
      Post.find.mockReturnValue(mockQuery);

      const res = await searchService.searchByHashtag('#test', { page: 1, limit: 5 });
      expect(Post.find).toHaveBeenCalledWith(expect.objectContaining({
        hashtags: 'test',
        visibility: 'public'
      }));
      expect(mockQuery.limit).toHaveBeenCalledWith(5);
      expect(res).toHaveLength(1);
    });
  });

  describe('getTrendingHashtags', () => {
    it('should aggregate trending hashtags in last 24h', async () => {
      Post.aggregate.mockResolvedValue([{ hashtag: 'trend', count: 10 }]);
      const res = await searchService.getTrendingHashtags(5);
      expect(Post.aggregate).toHaveBeenCalled();
      expect(res).toEqual([{ hashtag: 'trend', count: 10 }]);
    });
  });
});
