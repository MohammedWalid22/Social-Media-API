const Post = require('../models/Post');
const User = require('../models/User');
const redis = require('../config/redis');
const logger = require('../utils/logger');

class FeedGeneratorService {
  async generatePersonalizedFeed(userId, options = {}) {
    const { cursor, limit = 20, filter = 'all' } = options;

    try {
      // Check cache first
      const cacheKey = `feed:${userId}:${filter}:${cursor || 'initial'}`;
      const cached = await redis.get(cacheKey);
      
      if (cached && !cursor) {
        logger.info(`Serving cached feed for user ${userId}`);
        return cached;
      }

      const user = await User.findById(userId).select('following blockedUsers interests');
      
      const pipeline = this.buildFeedPipeline(userId, user, cursor, filter);
      
      let posts = await Post.aggregate(pipeline).allowDiskUse(true);

      // Get next cursor
      const nextCursor = posts.length === limit 
        ? posts[posts.length - 1].createdAt.toISOString() 
        : null;

      // If we got extra post (limit + 1), remove it
      if (posts.length > limit) {
        posts.pop();
      }

      const result = {
        posts,
        nextCursor,
        total: posts.length,
      };

      // Cache if not paginating
      if (!cursor) {
        await redis.set(cacheKey, result, 300); // 5 minutes
      }

      return result;
    } catch (error) {
      logger.error('Feed generation error:', error);
      throw error;
    }
  }

  buildFeedPipeline(userId, user, cursor, filter) {
    const matchStage = {
      $match: {
        $and: [
          // Exclude blocked users
          { author: { $nin: user.blockedUsers || [] } },
          // Not from deleted accounts
          { 'author.accountDeleted': { $ne: true } },
        ],
      },
    };

    // Visibility rules
    const visibilityRules = [
      { visibility: 'public' },
      { author: { $in: user.following }, visibility: { $in: ['friends', 'followers'] } },
      { author: userId }, // Own posts
    ];

    matchStage.$match.$and.push({ $or: visibilityRules });

    // Not expired stories or regular posts
    matchStage.$match.$and.push({
      $or: [
        { isStory: false },
        { isStory: true, expiresAt: { $gt: new Date() } },
      ],
    });

    // Cursor pagination
    if (cursor) {
      matchStage.$match.$and.push({ createdAt: { $lt: new Date(cursor) } });
    }

    // Filter specific
    if (filter === 'following') {
      matchStage.$match.$and.push({ author: { $in: user.following } });
    }

    const pipeline = [
      matchStage,
      
      // Lookup author
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [
            { $project: {
              username: 1,
              displayName: 1,
              avatar: 1,
              isVerified: 1,
              verificationBadge: 1,
            }},
          ],
        },
      },
      { $unwind: '$author' },
      
      // Check if user liked
      {
        $addFields: {
          isLiked: { $in: [userId, '$likes.user'] },
          userReaction: this.getReactionExpression(userId),
        },
      },
      
      // Calculate relevance score
      {
        $addFields: {
          relevanceScore: {
            $let: {
              vars: {
                hoursOld: {
                  $divide: [{ $subtract: [new Date(), '$createdAt'] }, 3600000],
                },
                isFollowing: { $in: ['$author._id', user.following] },
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
      { $limit: parseInt(limit) + 1 }, // Get extra for cursor
      
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
          relevanceScore: 1,
        },
      },
    ];

    return pipeline;
  }

  getReactionExpression(userId) {
    return {
      $let: {
        vars: { reactions: '$reactions' },
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
    };
  }

  async invalidateCache(userId) {
    const pattern = `feed:${userId}:*`;
    // Note: This requires Redis scan, simplified here
    await redis.delete(`feed:${userId}:all:initial`);
    await redis.delete(`feed:${userId}:following:initial`);
  }
}

module.exports = new FeedGeneratorService();