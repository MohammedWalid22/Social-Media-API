const mongoose = require('mongoose');
const Post = require('../models/Post');

class ViralService {
  /**
   * Calculate the viral coefficient (K-factor) of a post.
   *
   * K-factor = (total reach / original audience size)
   * Where reach = all unique users who interacted across the share tree.
   *
   * K > 1  → Viral (exponential growth)
   * K = 1  → Stable spread
   * K < 1  → Dying down
   */
  async getViralStats(postId) {
    const postObjId = new mongoose.Types.ObjectId(postId);

    // Get the root post + all shares of it (recursive via sharedFrom)
    const shareChain = await Post.aggregate([
      {
        $match: {
          $or: [
            { _id: postObjId },
            { sharedFrom: postObjId },
          ],
        },
      },
      {
        $project: {
          author: 1,
          likesCount: 1,
          commentsCount: 1,
          sharesCount: 1,
          sharedFrom: 1,
          createdAt: 1,
          'shares.user': 1,
          'likes.user': 1,
        },
      },
    ]);

    if (!shareChain.length) return null;

    const root = shareChain.find((p) => p._id.toString() === postId);
    const shares = shareChain.filter((p) => p.sharedFrom);

    // Collect all unique users who engaged
    const allReachedUsers = new Set();
    for (const post of shareChain) {
      if (post.author) allReachedUsers.add(post.author.toString());
      (post.likes || []).forEach((l) => allReachedUsers.add(l.user?.toString()));
    }

    const totalReach = allReachedUsers.size;
    const originalAudience = root ? (root.likesCount + root.commentsCount + 1) : 1;
    const viralScore = Math.round((totalReach / Math.max(originalAudience, 1)) * 100) / 100;

    // Share depth: max chain length
    const shareDepth = shares.length > 0 ? Math.ceil(Math.log2(shares.length + 1)) : 0;

    // Peak engagement time
    const engagementTimeline = shareChain.map((p) => ({
      time: p.createdAt,
      engagement: (p.likesCount || 0) + (p.commentsCount || 0),
    }));
    const peak = engagementTimeline.sort((a, b) => b.engagement - a.engagement)[0];

    return {
      postId,
      viralScore,          // K-factor
      totalReach,          // Unique users reached
      totalShares: shares.length,
      shareDepth,          // Tree depth
      peakEngagementAt: peak?.time || null,
      classification:
        viralScore >= 2 ? '🔥 Viral' :
        viralScore >= 1 ? '📈 Growing' :
        '📉 Limited reach',
    };
  }

  /**
   * Get a visual share tree (up to depth 3 for performance).
   */
  async getShareTree(postId) {
    const postObjId = new mongoose.Types.ObjectId(postId);

    const shares = await Post.find({ sharedFrom: postObjId })
      .select('author likesCount commentsCount createdAt sharedFrom')
      .populate('author', 'username displayName avatar')
      .limit(50)
      .lean();

    return {
      rootId: postId,
      shareCount: shares.length,
      tree: shares.map((s) => ({
        id: s._id,
        sharedBy: s.author,
        likes: s.likesCount,
        comments: s.commentsCount,
        sharedAt: s.createdAt,
      })),
    };
  }

  /**
   * Top viral posts in a given timeframe across the platform.
   */
  async getViralLeaderboard(timeframe = '24h', limit = 10) {
    const timeMap = { '1h': 1, '24h': 24, '7d': 168, '30d': 720 };
    const hours = timeMap[timeframe] || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    return Post.aggregate([
      {
        $match: {
          visibility: 'public',
          moderationStatus: 'approved',
          createdAt: { $gte: since },
          isCapsule: { $ne: true },
        },
      },
      {
        $addFields: {
          viralScore: {
            $add: [
              { $multiply: ['$sharesCount', 5] },
              { $multiply: ['$commentsCount', 3] },
              { $multiply: ['$likesCount', 1] },
            ],
          },
        },
      },
      { $sort: { viralScore: -1 } },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
          pipeline: [{ $project: { username: 1, displayName: 1, avatar: 1, isVerified: 1 } }],
        },
      },
      { $unwind: '$author' },
      {
        $project: {
          'content.text': 1,
          author: 1,
          likesCount: 1,
          commentsCount: 1,
          sharesCount: 1,
          viralScore: 1,
          createdAt: 1,
        },
      },
    ]);
  }
}

module.exports = new ViralService();
