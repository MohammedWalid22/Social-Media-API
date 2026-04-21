const EchoChamberService = require('../services/echoChamberService');
const ViralService = require('../services/viralService');
const { AppError } = require('../middleware/errorHandler');

class InsightsController {
  /** GET /api/v1/insights/echo-chamber */
  async getEchoChamber(req, res, next) {
    try {
      const analysis = await EchoChamberService.analyzeDiversity(req.user._id);
      res.status(200).json({ status: 'success', data: analysis });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/insights/echo-chamber/trend */
  async getEchoChamberTrend(req, res, next) {
    try {
      const days = Math.min(parseInt(req.query.days) || 14, 30);
      const trend = await EchoChamberService.getDiversityTrend(req.user._id, days);
      res.status(200).json({ status: 'success', data: { trend, days } });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/insights/viral-leaderboard */
  async getViralLeaderboard(req, res, next) {
    try {
      const { timeframe = '24h', limit = 10 } = req.query;
      const leaderboard = await ViralService.getViralLeaderboard(timeframe, limit);
      res.status(200).json({
        status: 'success',
        timeframe,
        results: leaderboard.length,
        data: { leaderboard },
      });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/posts/:postId/viral-stats */
  async getPostViralStats(req, res, next) {
    try {
      const stats = await ViralService.getViralStats(req.params.postId);
      if (!stats) return next(new AppError('Post not found', 404));
      res.status(200).json({ status: 'success', data: { stats } });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/posts/:postId/share-tree */
  async getShareTree(req, res, next) {
    try {
      const tree = await ViralService.getShareTree(req.params.postId);
      res.status(200).json({ status: 'success', data: tree });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new InsightsController();
