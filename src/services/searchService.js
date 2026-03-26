const User = require('../models/User');
const Post = require('../models/Post');
const logger = require('../utils/logger');

class SearchService {
  async search(query, type = 'all', options = {}) {
    const { page = 1, limit = 20, userId } = options;
    const skip = (page - 1) * limit;

    const results = { users: [], posts: [], hashtags: [] };

    try {
      // Search users
      if (type === 'all' || type === 'users') {
        results.users = await this.searchUsers(query, { skip, limit });
      }

      // Search posts
      if (type === 'all' || type === 'posts') {
        results.posts = await this.searchPosts(query, { skip, limit, userId });
      }

      // Search hashtags
      if (type === 'all' || type === 'hashtags') {
        results.hashtags = await this.searchHashtags(query, { limit });
      }

      return results;
    } catch (error) {
      logger.error('Search error:', error);
      throw error;
    }
  }

  async searchUsers(query, { skip, limit }) {
    // Text search on username and displayName
    return await User.find(
      {
        $and: [
          {
            $or: [
              { $text: { $search: query } },
              { username: { $regex: query, $options: 'i' } },
              { displayName: { $regex: query, $options: 'i' } },
            ],
          },
          { accountDeleted: false },
          { suspended: { $ne: true } },
        ],
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .select('username displayName avatar isVerified followers');
  }

  async searchPosts(query, { skip, limit, userId }) {
    return await Post.find(
      {
        $and: [
          {
            $or: [
              { $text: { $search: query } },
              { 'content.text': { $regex: query, $options: 'i' } },
            ],
          },
          { visibility: 'public' },
          { moderationStatus: { $ne: 'rejected' } },
        ],
      },
      { score: { $meta: 'textScore' } }
    )
      .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatar isVerified');
  }

  async searchHashtags(query, { limit }) {
    // Remove # if present
    const cleanQuery = query.startsWith('#') ? query.slice(1) : query;

    const hashtags = await Post.aggregate([
      {
        $match: {
          hashtags: { $regex: cleanQuery, $options: 'i' },
          visibility: 'public',
        },
      },
      { $unwind: '$hashtags' },
      {
        $match: {
          hashtags: { $regex: cleanQuery, $options: 'i' },
        },
      },
      {
        $group: {
          _id: '$hashtags',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          hashtag: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]);

    return hashtags;
  }

  async searchByHashtag(hashtag, options = {}) {
    const { page = 1, limit = 20, userId } = options;
    const skip = (page - 1) * limit;

    const cleanHashtag = hashtag.toLowerCase().replace(/^#/, '');

    return await Post.find({
      hashtags: cleanHashtag,
      visibility: 'public',
      moderationStatus: { $ne: 'rejected' },
    })
      .sort('-createdAt')
      .skip(skip)
      .limit(limit)
      .populate('author', 'username displayName avatar isVerified');
  }

  async getTrendingHashtags(limit = 10) {
    return await Post.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          visibility: 'public',
        },
      },
      { $unwind: '$hashtags' },
      {
        $group: {
          _id: '$hashtags',
          count: { $sum: 1 },
          posts: { $push: '$_id' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          hashtag: '$_id',
          count: 1,
          _id: 0,
        },
      },
    ]);
  }
}

module.exports = new SearchService();