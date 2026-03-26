const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const AuditLog = require('../models/AuditLog');
const { AppError } = require('../middleware/errorHandler');

class AdminController {
  async getDashboardStats(req, res, next) {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const lastWeek = new Date(now - 7 * 24 * 60 * 60 * 1000);

      const stats = await Promise.all([
        // User stats
        User.countDocuments({ accountDeleted: false }),
        User.countDocuments({ createdAt: { $gte: today } }),
        User.countDocuments({ createdAt: { $gte: lastWeek } }),
        
        // Content stats
        Post.countDocuments(),
        Post.countDocuments({ createdAt: { $gte: today } }),
        
        // Moderation stats
        Post.countDocuments({ moderationStatus: 'flagged' }),
        Post.countDocuments({ moderationStatus: 'rejected' }),
        Comment.countDocuments({ moderationStatus: 'rejected' }),
        
        // Engagement
        Post.aggregate([
          { $group: { _id: null, totalLikes: { $sum: '$likesCount' } } },
        ]),
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          stats: {
            totalUsers: stats[0],
            todaySignups: stats[1],
            weeklySignups: stats[2],
            totalPosts: stats[3],
            todayPosts: stats[4],
            flaggedPosts: stats[5],
            rejectedPosts: stats[6],
            rejectedComments: stats[7],
            totalLikes: stats[8][0]?.totalLikes || 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFlaggedContent(req, res, next) {
    try {
      const { type = 'all', page = 1, limit = 20 } = req.query;

      const results = {};

      if (type === 'all' || type === 'posts') {
        results.posts = await Post.find({ moderationStatus: 'flagged' })
          .populate('author', 'username email avatar')
          .sort('-createdAt')
          .skip((page - 1) * limit)
          .limit(parseInt(limit));
      }

      if (type === 'all' || type === 'comments') {
        results.comments = await Comment.find({ moderationStatus: 'rejected' })
          .populate('author', 'username email avatar')
          .populate('post', 'content.text')
          .sort('-createdAt')
          .skip((page - 1) * limit)
          .limit(parseInt(limit));
      }

      res.status(200).json({
        status: 'success',
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }

  async moderateContent(req, res, next) {
    try {
      const { contentId, contentType, action, reason } = req.body;

      const Model = contentType === 'post' ? Post : Comment;
      
      const content = await Model.findByIdAndUpdate(
        contentId,
        {
          moderationStatus: action === 'approve' ? 'approved' : 'rejected',
          moderationReason: reason,
          moderatedBy: req.user._id,
          moderatedAt: new Date(),
        },
        { new: true }
      );

      if (!content) {
        return next(new AppError('Content not found', 404));
      }

      // Log moderation action
      await AuditLog.create({
        user: req.user._id,
        action: 'CONTENT_MODERATION',
        details: {
          contentId,
          contentType,
          action,
          reason,
        },
        severity: action === 'reject' ? 'high' : 'medium',
        ip: req.ip,
      });

      res.status(200).json({
        status: 'success',
        data: { content },
      });
    } catch (error) {
      next(error);
    }
  }

  async getAuditLogs(req, res, next) {
    try {
      const { page = 1, limit = 50, userId, action, severity } = req.query;

      const query = {};
      if (userId) query.user = userId;
      if (action) query.action = action;
      if (severity) query.severity = severity;

      const logs = await AuditLog.find(query)
        .sort('-timestamp')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('user', 'username email');

      const total = await AuditLog.countDocuments(query);

      res.status(200).json({
        status: 'success',
        results: logs.length,
        total,
        data: { logs },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 20, search, status } = req.query;

      const query = {};
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }
      if (status) query.accountDeleted = status === 'deleted';

      const users = await User.find(query)
        .select('-password -twoFactorSecret')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

      const total = await User.countDocuments(query);

      res.status(200).json({
        status: 'success',
        results: users.length,
        total,
        data: { users },
      });
    } catch (error) {
      next(error);
    }
  }

  async suspendUser(req, res, next) {
    try {
      const { userId } = req.params;
      const { reason, duration } = req.body;

      const user = await User.findByIdAndUpdate(
        userId,
        {
          suspended: true,
          suspendedAt: new Date(),
          suspendedUntil: duration ? new Date(Date.now() + duration) : null,
          suspensionReason: reason,
        },
        { new: true }
      );

      if (!user) {
        return next(new AppError('User not found', 404));
      }

      // Log action
      await AuditLog.create({
        user: req.user._id,
        action: 'USER_SUSPENSION',
        details: { targetUser: userId, reason, duration },
        severity: 'critical',
        ip: req.ip,
      });

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();