const User = require('../models/User');
const Post = require('../models/Post');
const logger = require('../utils/logger');

class RecommendationService {
  async getRecommendedUsers(userId, limit = 10) {
    try {
      const user = await User.findById(userId).select('following blockedUsers');
      
      if (!user) {
        return [];
      }

      // Find users followed by people you follow (friends of friends)
      const recommendations = await User.aggregate([
        {
          $match: {
            _id: { $in: user.following },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'following',
            foreignField: '_id',
            as: 'friendsOfFriends',
          },
        },
        { $unwind: '$friendsOfFriends' },
        {
          $match: {
            'friendsOfFriends._id': {
              $nin: [...user.following, userId, ...(user.blockedUsers || [])],
            },
            'friendsOfFriends.accountDeleted': false,
            'friendsOfFriends.suspended': { $ne: true },
          },
        },
        {
          $group: {
            _id: '$friendsOfFriends._id',
            count: { $sum: 1 },
            user: { $first: '$friendsOfFriends' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: limit },
        {
          $project: {
            _id: '$user._id',
            username: '$user.username',
            displayName: '$user.displayName',
            avatar: '$user.avatar',
            isVerified: '$user.isVerified',
            mutualFriends: '$count',
          },
        },
      ]);

      // If not enough, fill with popular users
      if (recommendations.length < limit) {
        const remaining = limit - recommendations.length;
        const existingIds = recommendations.map(r => r._id.toString());
        
        const popularUsers = await User.find({
          _id: { 
            $nin: [
              ...user.following.map(id => id.toString()), 
              userId.toString(),
              ...existingIds,
              ...(user.blockedUsers || []).map(id => id.toString()),
            ] 
          },
          accountDeleted: false,
          suspended: { $ne: true },
        })
          .sort('-followers.length')
          .limit(remaining)
          .select('username displayName avatar isVerified');

        recommendations.push(...popularUsers.map(u => ({
          ...u.toObject(),
          mutualFriends: 0,
        })));
      }

      return recommendations;
    } catch (error) {
      logger.error('User recommendation error:', error);
      return [];
    }
  }

  async getRecommendedPosts(userId, limit = 10) {
    try {
      const user = await User.findById(userId).select('following interests');

      // Get posts liked by people you follow but you haven't seen
      const pipeline = [
        {
          $match: {
            author: { $in: user.following },
            visibility: { $in: ['public', 'friends'] },
            'likes.user': { $ne: userId },
            _id: { $nin: await this.getUserInteractedPosts(userId) },
          },
        },
        {
          $addFields: {
            score: {
              $add: [
                { $multiply: ['$likesCount', 1] },
                { $multiply: ['$commentsCount', 2] },
                { $multiply: ['$sharesCount', 3] },
                {
                  $divide: [
                    { $subtract: [new Date(), '$createdAt'] },
                    3600000, // hours since posted
                  ],
                },
              ],
            },
          },
        },
        { $sort: { score: -1 } },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            'author.password': 0,
            'author.twoFactorSecret': 0,
          },
        },
      ];

      let posts = await Post.aggregate(pipeline);

      // If not enough, add trending posts
      if (posts.length < limit) {
        const remaining = limit - posts.length;
        const trendingPosts = await this.getTrendingPosts(userId, remaining, posts.map(p => p._id));
        posts = [...posts, ...trendingPosts];
      }

      return posts;
    } catch (error) {
      logger.error('Post recommendation error:', error);
      return [];
    }
  }

  async getUserInteractedPosts(userId) {
    const interactions = await Post.find({
      $or: [
        { 'likes.user': userId },
        { 'comments.author': userId },
        { author: userId },
      ],
    }).select('_id');
    
    return interactions.map(p => p._id);
  }

  async getTrendingPosts(userId, limit, excludeIds = []) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return await Post.find({
      _id: { $nin: excludeIds },
      createdAt: { $gte: oneDayAgo },
      visibility: 'public',
      moderationStatus: 'approved',
      'likes.user': { $ne: userId },
    })
      .sort('-likesCount')
      .limit(limit)
      .populate('author', 'username displayName avatar isVerified');
  }

  async getSimilarContent(postId, limit = 5) {
    try {
      const post = await Post.findById(postId).select('hashtags author');
      
      if (!post) return [];

      return await Post.find({
        _id: { $ne: postId },
        hashtags: { $in: post.hashtags },
        visibility: 'public',
        moderationStatus: 'approved',
      })
        .sort('-createdAt')
        .limit(limit)
        .populate('author', 'username displayName avatar');
    } catch (error) {
      logger.error('Similar content error:', error);
      return [];
    }
  }
}

module.exports = new RecommendationService();