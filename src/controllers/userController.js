const User = require('../models/User');
const Post = require('../models/Post');
const FollowRequest = require('../models/FollowRequest');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');
const AuditLog = require('../models/AuditLog');
const NotificationService = require('../services/notificationService'); // ✅ إضافة هذا السطر

class UserController {
  async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user._id)
        .populate('followers', 'username displayName avatar isVerified')
        .populate('following', 'username displayName avatar isVerified');

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req, res, next) {
    try {
      const { displayName, bio, privacySettings } = req.body;
      
      const updates = {};
      if (displayName) updates.displayName = displayName;
      if (bio) updates.bio = bio;
      if (privacySettings) updates.privacySettings = privacySettings;

      const user = await User.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
      );

      res.status(200).json({
        status: 'success',
        data: { user },
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadAvatar(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'fail',
          message: 'No file uploaded',
        });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'avatars',
        transformation: [
          { width: 400, height: 400, crop: 'fill' },
          { quality: 'auto' },
        ],
      });

      const user = await User.findById(req.user._id);
      if (user.avatar?.publicId) {
        await cloudinary.uploader.destroy(user.avatar.publicId);
      }

      user.avatar = {
        url: result.secure_url,
        publicId: result.public_id,
      };
      await user.save();

      res.status(200).json({
        status: 'success',
        data: { avatar: user.avatar },
      });
    } catch (error) {
      next(error);
    }
  }

  async getSavedPosts(req, res, next) {
    try {
      const user = await User.findById(req.user._id)
        .populate({
          path: 'savedPosts.post',
          populate: {
            path: 'author',
            select: 'username displayName avatar isVerified'
          }
        });

      if (!user) return next(new AppError('User not found', 404));

      // Sort by savedAt descending
      const savedPosts = user.savedPosts.sort((a, b) => b.savedAt - a.savedAt);

      res.status(200).json({
        status: 'success',
        results: savedPosts.length,
        data: { savedPosts }
      });
    } catch (error) {
      next(error);
    }
  }

  async getUserProfile(req, res, next) {
    try {
      const { username } = req.params;
      
      const user = await User.findOne({ username: username.toLowerCase() })
        .select('-email -twoFactorSecret -loginAttempts -lockUntil -passwordChangedAt');

      if (!user) {
        return res.status(404).json({
          status: 'fail',
          message: 'User not found',
        });
      }

      const isFollowing = req.user ? user.followers.includes(req.user._id) : false;
      const isSelf = req.user ? req.user._id.toString() === user._id.toString() : false;

      if (user.privacySettings.profileVisibility === 'private' && !isSelf && !isFollowing) {
        return res.status(403).json({
          status: 'fail',
          message: 'This profile is private',
        });
      }

      const posts = await Post.find({
        author: user._id,
        visibility: { $in: isSelf ? ['public', 'friends', 'private'] : (isFollowing ? ['public', 'friends'] : ['public']) },
      })
        .sort('-createdAt')
        .limit(10)
        .select('-__v');

      res.status(200).json({
        status: 'success',
        data: {
          user: {
            ...user.toObject(),
            isFollowing,
          },
          posts,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async followUser(req, res, next) {
    try {
      const { userId } = req.params;
      const currentUserId = req.user._id;

      if (userId === currentUserId.toString()) {
        return res.status(400).json({
          status: 'fail',
          message: 'Cannot follow yourself',
        });
      }

      const targetUser = await User.findById(userId);
      if (!targetUser) {
        return res.status(404).json({
          status: 'fail',
          message: 'User not found',
        });
      }

      const isFollowing = targetUser.followers.includes(currentUserId);

      if (isFollowing) {
        // Unfollow
        targetUser.followers = targetUser.followers.filter(
          id => id.toString() !== currentUserId.toString()
        );
        req.user.following = req.user.following.filter(
          id => id.toString() !== userId
        );
      } else {
        // Follow
        if (targetUser.privacySettings.profileVisibility === 'private') {
          // Send follow request
          await FollowRequest.create({
            requester: currentUserId,
            recipient: userId,
            status: 'pending',
          });

          await NotificationService.create({
            recipient: userId,
            sender: currentUserId,
            type: 'follow_request',
          });

          return res.status(200).json({
            status: 'success',
            message: 'Follow request sent',
            data: { requested: true },
          });
        }

        targetUser.followers.push(currentUserId);
        req.user.following.push(userId);

        await NotificationService.create({
          recipient: userId,
          sender: currentUserId,
          type: 'follow',
        });
      }

      await Promise.all([targetUser.save(), req.user.save()]);

      res.status(200).json({
        status: 'success',
        data: {
          following: !isFollowing,
          followersCount: targetUser.followers.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFollowers(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const user = await User.findById(userId).populate({
        path: 'followers',
        select: 'username displayName avatar isVerified',
        options: {
          skip: (page - 1) * limit,
          limit: parseInt(limit),
        },
      });

      if (!user) {
        return res.status(404).json({
          status: 'fail',
          message: 'User not found',
        });
      }

      res.status(200).json({
        status: 'success',
        results: user.followers.length,
        data: { followers: user.followers },
      });
    } catch (error) {
      next(error);
    }
  }

  async searchUsers(req, res, next) {
    try {
      const { q, page = 1, limit = 20 } = req.query;

      if (!q || q.length < 2) {
        return res.status(400).json({
          status: 'fail',
          message: 'Query must be at least 2 characters',
        });
      }

      const users = await User.find(
        {
          $text: { $search: q },
          accountDeleted: false,
        },
        {
          score: { $meta: 'textScore' },
        }
      )
        .sort({ score: { $meta: 'textScore' } })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('username displayName avatar isVerified');

      res.status(200).json({
        status: 'success',
        results: users.length,
        data: { users },
      });
    } catch (error) {
      next(error);
    }
  }

  async blockUser(req, res, next) {
    try {
      const { userId } = req.params;
      
      if (req.user.blockedUsers.includes(userId)) {
        // Unblock
        req.user.blockedUsers = req.user.blockedUsers.filter(
          id => id.toString() !== userId
        );
      } else {
        // Block
        req.user.blockedUsers.push(userId);
        
        req.user.following = req.user.following.filter(
          id => id.toString() !== userId
        );
        req.user.followers = req.user.followers.filter(
          id => id.toString() !== userId
        );

        await User.findByIdAndUpdate(userId, {
          $pull: { followers: req.user._id, following: req.user._id },
        });
      }

      await req.user.save();

      res.status(200).json({
        status: 'success',
        data: {
          blocked: req.user.blockedUsers.includes(userId),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const { password } = req.body;

      const user = await User.findById(req.user._id).select('+password');
      if (!(await user.comparePassword(password))) {
        return res.status(401).json({
          status: 'fail',
          message: 'Incorrect password',
        });
      }

      user.accountDeleted = true;
      user.deletionScheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
      user.email = `deleted_${user._id}@deleted.com`;
      user.username = `deleted_${user._id}`;
      user.avatar = undefined;
      user.bio = undefined;
      await user.save();

      await AuditLog.create({
        user: user._id,
        action: 'ACCOUNT_DELETION_REQUESTED',
        ip: req.ip,
      });

      res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
      });

      res.status(200).json({
        status: 'success',
        message: 'Account scheduled for deletion',
      });
    } catch (error) {
      next(error);
    }
  }

  async uploadCover(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          status: 'fail',
          message: 'No file uploaded',
        });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'covers',
        transformation: [
          { width: 1500, height: 500, crop: 'fill' },
          { quality: 'auto' },
        ],
      });

      const user = await User.findById(req.user._id);
      if (user.coverImage?.publicId) {
        await cloudinary.uploader.destroy(user.coverImage.publicId);
      }

      user.coverImage = {
        url: result.secure_url,
        publicId: result.public_id,
      };
      await user.save();

      res.status(200).json({
        status: 'success',
        data: { coverImage: user.coverImage },
      });
    } catch (error) {
      next(error);
    }
  }

  async getFollowing(req, res, next) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const user = await User.findById(userId).populate({
        path: 'following',
        select: 'username displayName avatar isVerified',
        options: {
          skip: (page - 1) * limit,
          limit: parseInt(limit),
        },
      });

      if (!user) {
        return res.status(404).json({ 
          status: 'fail', 
          message: 'User not found' 
        });
      }

      res.status(200).json({
        status: 'success',
        results: user.following.length,
        data: { following: user.following },
      });
    } catch (error) {
      next(error);
    }
  }

  async muteUser(req, res, next) {
    try {
      const { userId } = req.params;
      
      // TODO: Implement mute functionality
      
      res.status(200).json({
        status: 'success',
        message: 'User muted',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();