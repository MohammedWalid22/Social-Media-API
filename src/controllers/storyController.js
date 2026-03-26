const Story = require('../models/Story');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const { AppError } = require('../middleware/errorHandler');

class StoryController {
  async createStory(req, res, next) {
    try {
      const { type, text, backgroundColor, font } = req.body;
      
      let content = { type };

      if (type === 'text') {
        content.text = text;
        content.backgroundColor = backgroundColor || '#000000';
        content.font = font || 'default';
      } else if (req.file) {
        // Upload media
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'stories',
          resource_type: type === 'video' ? 'video' : 'image',
        });
        
        content.url = result.secure_url;
      }

      const story = await Story.create({
        author: req.user._id,
        content,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      await story.populate('author', 'username avatar');

      res.status(201).json({
        status: 'success',
        data: { story },
      });
    } catch (error) {
      next(error);
    }
  }

  async getStoriesFeed(req, res, next) {
    try {
      const userId = req.user._id;
      
      // Get users that current user follows + self
      const user = await User.findById(userId).select('following');
      const storyUsers = [...user.following, userId];

      // Get active stories grouped by user
      const stories = await Story.aggregate([
        {
          $match: {
            author: { $in: storyUsers },
            expiresAt: { $gt: new Date() },
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: '$author',
            stories: { $push: '$$ROOT' },
            latestStory: { $first: '$$ROOT' },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            'author.password': 0,
            'author.twoFactorSecret': 0,
          },
        },
      ]);

      res.status(200).json({
        status: 'success',
        results: stories.length,
        data: { stories },
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserStories(req, res, next) {
    try {
      const { userId } = req.params;

      const stories = await Story.find({
        author: userId,
        expiresAt: { $gt: new Date() },
      })
        .sort('createdAt')
        .populate('author', 'username avatar');

      res.status(200).json({
        status: 'success',
        data: { stories },
      });
    } catch (error) {
      next(error);
    }
  }

  async viewStory(req, res, next) {
    try {
      const { storyId } = req.params;
      const userId = req.user._id;

      const story = await Story.findById(storyId);
      if (!story) {
        return next(new AppError('Story not found', 404));
      }

      // Check if already viewed
      const alreadyViewed = story.viewers.some(
        v => v.user.toString() === userId.toString()
      );

      if (!alreadyViewed) {
        story.viewers.push({
          user: userId,
          viewedAt: new Date(),
        });
        await story.save();
      }

      res.status(200).json({
        status: 'success',
        data: { viewed: true },
      });
    } catch (error) {
      next(error);
    }
  }

  async reactToStory(req, res, next) {
    try {
      const { storyId } = req.params;
      const { reaction } = req.body;
      const userId = req.user._id;

      const story = await Story.findById(storyId);
      if (!story) {
        return next(new AppError('Story not found', 404));
      }

      // Update or add reaction
      const viewerIndex = story.viewers.findIndex(
        v => v.user.toString() === userId.toString()
      );

      if (viewerIndex > -1) {
        story.viewers[viewerIndex].reaction = reaction;
      } else {
        story.viewers.push({
          user: userId,
          viewedAt: new Date(),
          reaction,
        });
      }

      await story.save();

      res.status(200).json({
        status: 'success',
        data: { reaction },
      });
    } catch (error) {
      next(error);
    }
  }

  async addToHighlights(req, res, next) {
    try {
      const { storyId } = req.params;
      const { name } = req.body;

      const story = await Story.findOne({
        _id: storyId,
        author: req.user._id,
      });

      if (!story) {
        return next(new AppError('Story not found', 404));
      }

      story.isHighlight = true;
      story.highlightName = name;
      story.expiresAt = undefined; // Remove expiration

      await story.save();

      res.status(200).json({
        status: 'success',
        data: { story },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteStory(req, res, next) {
    try {
      const { storyId } = req.params;

      const story = await Story.findOne({
        _id: storyId,
        author: req.user._id,
      });

      if (!story) {
        return next(new AppError('Story not found', 404));
      }

      // Delete media from cloudinary if exists
      if (story.content?.url) {
        const publicId = cloudinary.getPublicIdFromUrl(story.content.url);
        if (publicId) {
          await cloudinary.deleteFromCloudinary(publicId);
        }
      }

      await story.deleteOne();

      res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new StoryController();