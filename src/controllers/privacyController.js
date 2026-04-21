const PrivacyLog = require('../models/PrivacyLog');

class PrivacyController {
  /** GET /api/v1/privacy/audit-log */
  async getAuditLog(req, res, next) {
    try {
      const { page = 1, limit = 20, event } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const filter = { targetUser: req.user._id };
      if (event) filter.event = event;

      const [logs, total] = await Promise.all([
        PrivacyLog.find(filter)
          .sort('-createdAt')
          .skip(skip)
          .limit(parseInt(limit))
          .populate('actor', 'username displayName avatar')
          .lean(),
        PrivacyLog.countDocuments(filter),
      ]);

      // Anonymize actors who are not followers (privacy-by-default)
      const followerIds = req.user.followers?.map((f) => f.toString()) || [];

      const displayLogs = logs.map((log) => {
        const actorId = log.actor?._id?.toString();
        const isFollower = actorId && followerIds.includes(actorId);
        return {
          ...log,
          actor: isFollower ? log.actor : (log.actor ? { anonymous: true } : null),
        };
      });

      res.status(200).json({
        status: 'success',
        results: logs.length,
        total,
        page: parseInt(page),
        data: { logs: displayLogs },
      });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/privacy/profile-views */
  async getProfileViews(req, res, next) {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [total, byDay] = await Promise.all([
        PrivacyLog.countDocuments({
          targetUser: req.user._id,
          event: 'profile_viewed',
          createdAt: { $gte: since },
        }),
        PrivacyLog.aggregate([
          {
            $match: {
              targetUser: req.user._id,
              event: 'profile_viewed',
              createdAt: { $gte: since },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          totalViews: total,
          periodDays: 30,
          dailyBreakdown: byDay.map((d) => ({ date: d._id, count: d.count })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/privacy/audit-log/summary */
  async getSummary(req, res, next) {
    try {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const summary = await PrivacyLog.aggregate([
        { $match: { targetUser: req.user._id, createdAt: { $gte: since } } },
        { $group: { _id: '$event', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      res.status(200).json({
        status: 'success',
        data: {
          periodDays: 7,
          summary: summary.map((s) => ({ event: s._id, count: s.count })),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/v1/privacy/audit-log — GDPR: clear all my logs */
  async clearLog(req, res, next) {
    try {
      const result = await PrivacyLog.deleteMany({ targetUser: req.user._id });
      res.status(200).json({
        status: 'success',
        message: `${result.deletedCount} privacy log entries deleted.`,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PrivacyController();
