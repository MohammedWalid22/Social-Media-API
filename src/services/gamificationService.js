const User = require('../models/User');

class GamificationService {
  async addPoints(userId, points) {
    try {
      const user = await User.findById(userId);
      if (!user) return;
      
      if (!user.gamification) {
        user.gamification = { points: 0, badges: [] };
      }
      
      user.gamification.points += points;

      // Check for badges
      const { points: totalPoints, badges } = user.gamification;
      
      let badgeAdded = false;
      if (totalPoints >= 100 && !badges.includes('active_member')) {
        badges.push('active_member');
        badgeAdded = true;
      }
      if (totalPoints >= 500 && !badges.includes('top_commenter')) {
        badges.push('top_commenter');
        badgeAdded = true;
      }
      if (totalPoints >= 1000 && !badges.includes('popular_writer')) {
        badges.push('popular_writer');
        badgeAdded = true;
      }

      // Save without triggering password validation
      await user.save({ validateBeforeSave: false });
      
      return badgeAdded;
    } catch (err) {
      console.error('GamificationService Error:', err);
    }
  }
}

module.exports = new GamificationService();
