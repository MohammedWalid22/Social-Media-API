const mongoose = require('mongoose');
const cron = require('node-cron');
const Post = require('../src/models/Post');
const Story = require('../src/models/Story');
const AuditLog = require('../src/models/AuditLog');
const User = require('../src/models/User');
const database = require('../src/config/database');
const logger = require('../src/utils/logger');

class CleanupService {
  constructor() {
    this.jobs = [];
  }

  async start() {
    await database.connect();

    // Schedule jobs
    this.scheduleExpiredStories();
    this.scheduleExpiredPosts();
    this.scheduleOldAuditLogs();
    this.scheduleSoftDeletedUsers();
    this.scheduleOrphanedFiles();

    logger.info('✅ Cleanup service started');
  }

  scheduleExpiredStories() {
    // Run every hour
    const job = cron.schedule('0 * * * *', async () => {
      try {
        const result = await Story.deleteMany({
          isHighlight: false,
          expiresAt: { $lt: new Date() },
        });
        logger.info(`Cleaned up ${result.deletedCount} expired stories`);
      } catch (error) {
        logger.error('Story cleanup error:', error);
      }
    });
    
    this.jobs.push(job);
  }

  scheduleExpiredPosts() {
    // Run every 6 hours
    const job = cron.schedule('0 */6 * * *', async () => {
      try {
        const result = await Post.deleteMany({
          isStory: true,
          expiresAt: { $lt: new Date() },
        });
        logger.info(`Cleaned up ${result.deletedCount} expired posts`);
      } catch (error) {
        logger.error('Post cleanup error:', error);
      }
    });
    
    this.jobs.push(job);
  }

  scheduleOldAuditLogs() {
    // Run daily at midnight
    const job = cron.schedule('0 0 * * *', async () => {
      try {
        const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
        const result = await AuditLog.deleteMany({
          timestamp: { $lt: oneYearAgo },
          severity: { $in: ['low', 'medium'] },
        });
        logger.info(`Cleaned up ${result.deletedCount} old audit logs`);
      } catch (error) {
        logger.error('Audit log cleanup error:', error);
      }
    });
    
    this.jobs.push(job);
  }

  scheduleSoftDeletedUsers() {
    // Run weekly
    const job = cron.schedule('0 0 * * 0', async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        
        const usersToDelete = await User.find({
          accountDeleted: true,
          deletionScheduledAt: { $lt: thirtyDaysAgo },
        });

        for (const user of usersToDelete) {
          // Hard delete user's data
          await Post.deleteMany({ author: user._id });
          await Comment.deleteMany({ author: user._id });
          await require('../src/models/Message').deleteMany({
            $or: [{ sender: user._id }, { recipient: user._id }],
          });
          
          // Finally delete user
          await user.deleteOne();
          
          logger.info(`Hard deleted user: ${user._id}`);
        }
      } catch (error) {
        logger.error('User cleanup error:', error);
      }
    });
    
    this.jobs.push(job);
  }

  scheduleOrphanedFiles() {
    // Run weekly
    const job = cron.schedule('0 0 * * 0', async () => {
      // TODO: Implement orphaned file cleanup
      // This would scan cloud storage for files not referenced in DB
      logger.info('Orphaned file cleanup - TODO');
    });
    
    this.jobs.push(job);
  }

  stop() {
    this.jobs.forEach(job => job.stop());
    logger.info('Cleanup service stopped');
  }
}

// Run if called directly
if (require.main === module) {
  const service = new CleanupService();
  service.start();
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    service.stop();
    process.exit(0);
  });
}

module.exports = CleanupService;