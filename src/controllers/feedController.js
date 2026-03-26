const Post = require('../models/Post');
const User = require('../models/User');
const logger = require('../utils/logger');

class FeedController {
  async getNewsFeed(req, res, next) {
    try {
      const userId = req.user._id;
      const { cursor, limit = 10, filter = 'all' } = req.query;

      const user = await User.findById(userId).select('following blockedUsers privacySettings mutedWords');
      
      const pipeline = this.buildFeedPipeline(userId, user.following, user.blockedUsers, cursor, filter, user.privacySettings?.positivityMode, user.mutedWords);
      
      const posts = await Post.aggregate(pipeline).allowDiskUse(true);
      
      const nextCursor = posts.length === parseInt(limit) 
        ? posts[posts.length - 1].createdAt.toISOString() 
        : null;

      res.status(200).json({
        status: 'success',
        results: posts.length,
        data: {
          posts,
          nextCursor,
        },
      });
      
    } catch (error) {
      next(error);
    }
  }

  buildFeedPipeline(userId, following, blockedUsers, cursor, filter, positivityMode, mutedWords) {
    const matchConditions = [
      { author: { $nin: blockedUsers || [] } },
      {
        $or: [
          { visibility: 'public' },
          { author: { $in: following }, visibility: { $in: ['friends', 'followers'] } },
          { author: userId },
        ],
      },
      {
        $or: [
          { isStory: false },
          { isStory: true, expiresAt: { $gt: new Date() } },
        ],
      },
    ];

    if (cursor) {
      matchConditions.push({ createdAt: { $lt: new Date(cursor) } });
    }

    if (positivityMode) {
      matchConditions.push({ sentimentScore: { $gte: -0.1 } });
    }

    if (mutedWords && mutedWords.length > 0) {
      const pattern = mutedWords.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      matchConditions.push({
        'content.text': { $not: { $regex: pattern, $options: 'i' } }
      });
    }

    const matchStage = {
      $match: {
        $and: matchConditions,
      },
    };

    const pipeline = [
      matchStage,
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [
            {
              $project: {
                username: 1,
                displayName: 1,
                avatar: 1,
                isVerified: 1,
                verificationBadge: 1,
              },
            },
          ],
        },
      },
      { $unwind: '$author' },
      {
        $addFields: {
          isLiked: {
            $in: [userId, '$likes.user'],
          },
          userReaction: {
            $let: {
              vars: {
                reactions: '$reactions',
              },
              in: {
                $switch: {
                  branches: [
                    { case: { $in: [userId, '$$reactions.love'] }, then: 'love' },
                    { case: { $in: [userId, '$$reactions.laugh'] }, then: 'laugh' },
                    { case: { $in: [userId, '$$reactions.angry'] }, then: 'angry' },
                    { case: { $in: [userId, '$$reactions.sad'] }, then: 'sad' },
                  ],
                  default: null,
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          relevanceScore: {
            $let: {
              vars: {
                hoursOld: {
                  $divide: [
                    { $subtract: [new Date(), '$createdAt'] },
                    3600000, 
                  ],
                },
                isFollowing: { $in: ['$author._id', following] },
                engagement: {
                  $add: [
                    { $multiply: ['$likesCount', 1] },
                    { $multiply: ['$commentsCount', 2] },
                    { $multiply: ['$sharesCount', 3] },
                  ],
                },
              },
              in: {
                $add: [
                  { $multiply: [{ $exp: { $multiply: ['$$hoursOld', -0.1] } }, 100] },
                  { $multiply: ['$$engagement', 10] },
                  { $cond: ['$$isFollowing', 50, 0] },
                  { $cond: ['$author.isVerified', 20, 0] },
                ],
              },
            },
          },
        },
      },
      { $sort: { relevanceScore: -1, createdAt: -1 } },
      { $limit: parseInt(limit) + 1 },
      {
        $project: {
          content: 1,
          author: 1,
          media: 1,
          createdAt: 1,
          likesCount: 1,
          commentsCount: 1,
          sharesCount: 1,
          isLiked: 1,
          userReaction: 1,
          visibility: 1,
          location: 1,
          poll: 1,
          contentWarning: 1,
          isStory: 1,
          expiresAt: 1,
        },
      },
    ];

    return pipeline;
  }

  async getTrending(req, res, next) {
    try {
      const { timeframe = '24h', category } = req.query;
      
      const timeMap = {
        '1h': 1,
        '24h': 24,
        '7d': 168,
        '30d': 720,
      };
      
      const hours = timeMap[timeframe] || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const pipeline = [
        {
          $match: {
            createdAt: { $gte: since },
            visibility: 'public',
            moderationStatus: 'approved',
          },
        },
        {
          $addFields: {
            trendingScore: {
              $add: [
                { $multiply: ['$likesCount', 1] },
                { $multiply: ['$commentsCount', 3] },
                { $multiply: ['$sharesCount', 5] },
                {
                  $divide: [
                    1000,
                    { $add: [{ $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000] }, 1] },
                  ],
                },
              ],
            },
          },
        },
        { $sort: { trendingScore: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
      ];

      if (category) {
        pipeline[0].$match.hashtags = category;
      }

      const trending = await Post.aggregate(pipeline);
      
      res.status(200).json({
        status: 'success',
        data: { trending },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getNearbyPosts(req, res, next) {
    try {
      const { longitude, latitude, radius = 5000 } = req.query; 
      
      const posts = await Post.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)],
            },
            distanceField: 'distance',
            maxDistance: parseInt(radius),
            spherical: true,
            query: {
              visibility: 'public',
              'location.coordinates': { $exists: true },
            },
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 20 },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
      ]);

      res.status(200).json({
        status: 'success',
        data: { posts },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getSuggestedUsers(req, res, next) {
    try {
      const userId = req.user._id;
      const { limit = 10 } = req.query;

      const user = await User.findById(userId).select('following');
      
      const suggestions = await User.aggregate([
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
        {
          $unwind: '$friendsOfFriends',
        },
        {
          $match: {
            'friendsOfFriends._id': { 
              $nin: [...user.following, userId] 
            },
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
        { $limit: parseInt(limit) },
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

      res.status(200).json({
        status: 'success',
        data: { users: suggestions },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSuggestedPosts(req, res, next) {
    try {
      const userId = req.user._id;
      const { limit = 10 } = req.query;

      const posts = await Post.find({
        visibility: 'public',
        'likes.user': { $ne: userId },
        author: { $ne: userId },
      })
        .sort('-likesCount')
        .limit(parseInt(limit))
        .populate('author', 'username displayName avatar isVerified');

      res.status(200).json({
        status: 'success',
        data: { posts },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new FeedController();