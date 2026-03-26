const Post = require('../models/User');
const User = require('../models/User');
const logger = require('../utils/logger');

class AnalyticsService {
  async getUserEngagement(userId, timeframe = '7d') {
    try {
      const since = new Date(Date.now() - this.parseTimeframe(timeframe));

      const stats = await Post.aggregate([
        {
          $match: {
            author: mongoose.Types.ObjectId(userId),
            createdAt: { $gte: since },
          },
        },
        {
          $group: {
            _id: null,
            totalPosts: { $sum: 1 },
            totalLikes: { $sum: '$likesCount' },
            totalComments: { $sum: '$commentsCount' },
            totalShares: { $sum: '$sharesCount' },
            avgEngagement: {
              $avg: { $add: ['$likesCount', '$commentsCount', '$sharesCount'] },
            },
          },
        },
      ]);

      const result = stats[0] || {
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        totalShares: 0,
        avgEngagement: 0,
      };

      // Calculate engagement rate
      const user = await User.findById(userId).select('followers');
      const followerCount = user?.followers?.length || 0;
      
      result.engagementRate = followerCount > 0 
        ? ((result.totalLikes + result.totalComments + result.totalShares) / followerCount / Math.max(result.totalPosts, 1)) * 100
        : 0;

      return result;
    } catch (error) {
      logger.error('User engagement error:', error);
      throw error;
    }
  }

  async getPostAnalytics(postId) {
    try {
      const post = await Post.findById(postId)
        .select('likesCount commentsCount sharesCount createdAt views');

      if (!post) {
        throw new Error('Post not found');
      }

      const hoursSincePosted = (Date.now() - post.createdAt) / (1000 * 60 * 60);
      
      return {
        ...post.toObject(),
        hoursSincePosted: Math.round(hoursSincePosted),
        engagementVelocity: {
          likesPerHour: post.likesCount / Math.max(hoursSincePosted, 1),
          commentsPerHour: post.commentsCount / Math.max(hoursSincePosted, 1),
        },
      };
    } catch (error) {
      logger.error('Post analytics error:', error);
      throw error;
    }
  }

  async getAudienceDemographics(userId) {
    // This would integrate with analytics service in production
    // Placeholder implementation
    return {
      ageGroups: {
        '18-24': 25,
        '25-34': 35,
        '35-44': 20,
        '45+': 20,
      },
      gender: {
        male: 45,
        female: 50,
        other: 5,
      },
      topLocations: [],
    };
  }

  parseTimeframe(tf) {
    const map = {
      '1d': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = map[tf];
    if (!days) throw new Error(`Invalid timeframe: ${tf}`);
    return days * 24 * 60 * 60 * 1000;
  }
}

module.exports = new AnalyticsService();