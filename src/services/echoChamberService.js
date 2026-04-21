const InteractionHistory = require('../models/InteractionHistory');
const Post = require('../models/Post');
const logger = require('../utils/logger');

class EchoChamberService {
  /**
   * Record a user interaction for later diversity analysis.
   * Called fire-and-forget from controllers.
   */
  async trackInteraction(userId, postId, interactionType) {
    try {
      const post = await Post.findById(postId).select('hashtags sentimentScore').lean();
      if (!post) return;

      await InteractionHistory.create({
        user: userId,
        post: postId,
        hashtags: post.hashtags || [],
        interactionType,
        sentimentScore: post.sentimentScore || 0,
      });
    } catch (err) {
      logger.warn('EchoChamberService.trackInteraction error:', err.message);
    }
  }

  /**
   * Analyze the diversity of a user's last 30 days of interactions.
   *
   * Uses Shannon Entropy:
   *   H = -Σ(p_i * log2(p_i))
   *
   * A score of 0 = pure echo chamber (one topic)
   * A score of 100 = perfectly diverse
   */
  async analyzeDiversity(userId) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const interactions = await InteractionHistory.find({
      user: userId,
      createdAt: { $gte: since },
    }).lean();

    if (interactions.length < 5) {
      return {
        diversityScore: null,
        warningLevel: 'insufficient_data',
        message: 'Not enough interactions yet (need at least 5). Explore more content!',
        topTopics: [],
        suggestions: [],
      };
    }

    // --- Hashtag frequency map ---
    const tagFreq = {};
    let totalTagged = 0;

    for (const interaction of interactions) {
      for (const tag of interaction.hashtags) {
        tagFreq[tag] = (tagFreq[tag] || 0) + 1;
        totalTagged++;
      }
    }

    // --- Shannon Entropy ---
    let entropy = 0;
    if (totalTagged > 0) {
      for (const count of Object.values(tagFreq)) {
        const p = count / totalTagged;
        entropy -= p * Math.log2(p);
      }
    }

    // Normalize: max entropy = log2(uniqueTopics)
    const uniqueTopics = Object.keys(tagFreq).length;
    const maxEntropy = uniqueTopics > 1 ? Math.log2(uniqueTopics) : 1;
    const diversityScore = Math.round((entropy / maxEntropy) * 100);

    // --- Sentiment average ---
    const avgSentiment =
      interactions.reduce((sum, i) => sum + (i.sentimentScore || 0), 0) /
      interactions.length;

    // --- Warning level ---
    let warningLevel = 'healthy';
    let message = '🌍 Great! Your content is diverse and well-balanced.';
    if (diversityScore < 30) {
      warningLevel = 'high';
      message =
        '⚠️ You might be in an echo chamber! You\'re seeing mostly the same type of content.';
    } else if (diversityScore < 55) {
      warningLevel = 'moderate';
      message = '💡 Your feed is somewhat limited. Try exploring new topics!';
    }

    // --- Top topics ---
    const topTopics = Object.entries(tagFreq)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count, percentage: Math.round((count / totalTagged) * 100) }));

    // --- Suggestions (topics not in user's history) ---
    const popularTags = await this._getPopularTags(Object.keys(tagFreq));
    
    return {
      diversityScore,
      warningLevel,
      message,
      topTopics,
      suggestions: popularTags,
      stats: {
        totalInteractions: interactions.length,
        uniqueTopics,
        averageSentiment: Math.round(avgSentiment * 100) / 100,
        periodDays: 30,
      },
    };
  }

  /**
   * Get diversity trend over time (daily scores for the past N days).
   */
  async getDiversityTrend(userId, days = 14) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await InteractionHistory.aggregate([
      { $match: { user: userId, createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          hashtags: { $push: '$hashtags' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((day) => {
      const allTags = day.hashtags.flat();
      const unique = new Set(allTags).size;
      const total = allTags.length;
      return {
        date: day._id,
        interactions: day.count,
        uniqueTopics: unique,
        simpleDiversityRatio: total > 0 ? Math.round((unique / total) * 100) : 0,
      };
    });
  }

  async _getPopularTags(excludeTags) {
    const result = await Post.aggregate([
      { $match: { visibility: 'public', createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $unwind: '$hashtags' },
      { $match: { hashtags: { $nin: excludeTags } } },
      { $group: { _id: '$hashtags', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    return result.map((r) => r._id);
  }
}

module.exports = new EchoChamberService();
