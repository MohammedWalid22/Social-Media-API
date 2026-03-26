const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const NotificationService = require('../services/notificationService');
const ContentModeration = require('../services/contentModeration');
const GamificationService = require('../services/gamificationService');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');
const { AppError } = require('../middleware/errorHandler');

class PostController {
  createPost = async (req, res, next) => {
    try {
      const { content, media, visibility, location, poll, contentWarning, expiresAt, coAuthors } = req.body;
      
      // AI Content Moderation
      const moderationResult = await ContentModeration.analyze(content, media);
      if (moderationResult.severity === 'high') {
        return next(new AppError('Content violates community guidelines', 400));
      }

      // Extract mentions and hashtags
      const mentions = this.extractMentions(content);
      const hashtags = this.extractHashtags(content);

      // Process media uploads if provided
      const processedMedia = [];
      if (media && media.length > 0) {
        for (const file of media) {
          const result = await cloudinary.uploadToCloudinary(file.path, 'posts');
          processedMedia.push({
            type: file.mimetype.startsWith('image/') ? 'image' : 'video',
            url: result.url,
            publicId: result.publicId,
            thumbnail: result.thumbnail,
            metadata: {
              width: result.width,
              height: result.height,
              size: result.size,
              format: result.format,
            },
          });
        }
      }

      const post = await Post.create({
        author: req.user._id,
        coAuthors: (coAuthors || []).map(id => ({ user: id, status: 'pending' })),
        content: { text: content },
        media: processedMedia,
        visibility: visibility || req.user.privacySettings?.postVisibility || 'public',
        location,
        poll,
        contentWarning,
        mentions: mentions.map(username => ({ username })), // Will resolve to IDs in post-save hook
        hashtags,
        moderationStatus: moderationResult.severity === 'medium' ? 'flagged' : 'approved',
        moderationScore: moderationResult.score,
        sentimentScore: moderationResult.textAnalysis?.sentiment || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        isStory: !!expiresAt,
      });

      // Resolve mentions to user IDs and notify
      if (mentions.length > 0) {
        const mentionedUsers = await User.find({ 
          username: { $in: mentions } 
        }).select('_id');
        
        // Update post with resolved mentions
        post.mentions = mentionedUsers.map(u => ({ user: u._id }));
        await post.save();

        // Notify mentioned users
        await NotificationService.notifyMentions(
          mentions, 
          post._id, 
          req.user._id
        );
      }

      // Populate author before sending response
      await post.populate('author', 'username displayName avatar isVerified');

      // Add gamification points (10 points for creating a post)
      GamificationService.addPoints(req.user._id, 10).catch(err => logger.error('Gamification error:', err));

      res.status(201).json({
        status: 'success',
        data: { post },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async getPost(req, res, next) {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId)
        .populate('author', 'username displayName avatar isVerified')
        .populate({
          path: 'comments',
          options: { limit: 10, sort: { createdAt: -1 } },
          populate: {
            path: 'author',
            select: 'username displayName avatar',
          },
        });

      if (!post) {
        return next(new AppError('Post not found', 404));
      }

      // Check visibility permissions
      const canView = await this.canViewPost(post, req.user);
      if (!canView) {
        return next(new AppError('You do not have permission to view this post', 403));
      }

      // Check if user liked/reacted
      const isLiked = post.likes.some(like => 
        like.user.toString() === req.user?._id?.toString()
      );

      const userReaction = this.getUserReaction(post, req.user?._id);

      res.status(200).json({
        status: 'success',
        data: {
          post: {
            ...post.toObject(),
            isLiked,
            userReaction,
          },
        },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async updatePost(req, res, next) {
    try {
      const { postId } = req.params;
      const { content, visibility, contentWarning } = req.body;

      const post = await Post.findOne({
        _id: postId,
        author: req.user._id,
      });

      if (!post) {
        return next(new AppError('Post not found or you are not the author', 404));
      }

      // Don't allow editing stories after creation
      if (post.isStory) {
        return next(new AppError('Stories cannot be edited', 400));
      }

      // Update fields
      if (content) {
        post.content.text = content;
        post.isEdited = true;
        post.editedAt = new Date();
        
        // Re-extract hashtags and mentions
        post.hashtags = this.extractHashtags(content);
        post.mentions = this.extractMentions(content);
      }

      if (visibility) post.visibility = visibility;
      if (contentWarning) post.contentWarning = contentWarning;

      await post.save();

      res.status(200).json({
        status: 'success',
        data: { post },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async deletePost(req, res, next) {
    try {
      const { postId } = req.params;

      const post = await Post.findById(postId);

      if (!post) {
        return next(new AppError('Post not found', 404));
      }

      // Check authorization
      const isAuthorized = 
        post.author.toString() === req.user._id.toString() ||
        req.user.role === 'admin' ||
        req.user.role === 'moderator';

      if (!isAuthorized) {
        return next(new AppError('You are not authorized to delete this post', 403));
      }

      // Delete media from cloudinary
      for (const media of post.media) {
        if (media.publicId) {
          await cloudinary.deleteFromCloudinary(
            media.publicId, 
            media.type === 'video' ? 'video' : 'image'
          );
        }
      }

      // Delete associated comments
      await Comment.deleteMany({ post: postId });

      // Soft delete or hard delete
      await Post.findByIdAndDelete(postId);

      res.status(204).json({
        status: 'success',
        data: null,
      });
      
    } catch (error) {
      next(error);
    }
  }

  async likePost(req, res, next) {
    try {
      const { postId } = req.params;
      const { reaction = 'like' } = req.body;
      const userId = req.user._id;

      const post = await Post.findById(postId);
      if (!post) {
        return next(new AppError('Post not found', 404));
      }

      // Check if already liked
      const existingLikeIndex = post.likes.findIndex(
        l => l.user.toString() === userId.toString()
      );
      
      const existingLike = existingLikeIndex !== -1;

      if (existingLike) {
        // Remove like (toggle)
        post.likes.splice(existingLikeIndex, 1);
        post.likesCount = Math.max(0, post.likesCount - 1);
        
        // Remove from reactions
        Object.keys(post.reactions).forEach(key => {
          post.reactions[key] = post.reactions[key].filter(
            id => id.toString() !== userId.toString()
          );
        });
      } else {
        // Add like
        post.likes.push({ user: userId });
        post.likesCount++;
        
        // Add reaction
        if (post.reactions[reaction]) {
          post.reactions[reaction].push(userId);
        }

        // Notify author (if not self)
        if (post.author.toString() !== userId.toString()) {
          await NotificationService.create({
            recipient: post.author,
            sender: userId,
            type: 'like',
            post: postId,
          });
        }
      }

      await post.save();

      res.status(200).json({
        status: 'success',
        data: {
          likesCount: post.likesCount,
          isLiked: !existingLike,
          reaction: !existingLike ? reaction : null,
        },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async sharePost(req, res, next) {
    try {
      const { postId } = req.params;
      const { comment } = req.body;
      const userId = req.user._id;

      const originalPost = await Post.findById(postId);
      if (!originalPost) {
        return next(new AppError('Post not found', 404));
      }

      // Check if can view original post
      const canView = await this.canViewPost(originalPost, req.user);
      if (!canView) {
        return next(new AppError('You cannot share this post', 403));
      }

      // Create share record
      originalPost.shares.push({ user: userId });
      originalPost.sharesCount++;
      await originalPost.save();

      // Create new post as share
      const sharedPost = await Post.create({
        author: userId,
        content: { text: comment || '' },
        sharedFrom: postId,
        visibility: req.user.privacySettings?.postVisibility || 'public',
      });

      // Notify original author
      if (originalPost.author.toString() !== userId.toString()) {
        await NotificationService.create({
          recipient: originalPost.author,
          sender: userId,
          type: 'post_share',
          post: postId,
        });
      }

      res.status(201).json({
        status: 'success',
        data: { post: sharedPost },
      });
      
    } catch (error) {
      next(error);
    }
  }

  async respondToCoAuthorRequest(req, res, next) {
    try {
      const { postId } = req.params;
      const { status } = req.body; // 'accepted' or 'rejected'
      
      if (!['accepted', 'rejected'].includes(status)) {
        return next(new AppError('Invalid status', 400));
      }

      const post = await Post.findById(postId);
      if (!post) return next(new AppError('Post not found', 404));

      const coAuthorIndex = post.coAuthors.findIndex(ca => ca.user.toString() === req.user._id.toString());
      
      if (coAuthorIndex === -1) {
        return next(new AppError('You are not invited as a co-author', 403));
      }

      post.coAuthors[coAuthorIndex].status = status;
      await post.save();

      // Notify post author
      await NotificationService.create({
        recipient: post.author,
        sender: req.user._id,
        type: status === 'accepted' ? 'coauthor_accepted' : 'coauthor_rejected',
        post: postId
      });

      res.status(200).json({ status: 'success', message: `Co-author request ${status}` });
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  async savePost(req, res, next) {
    try {
      const { postId } = req.params;
      const userId = req.user._id;

      const post = await Post.findById(postId);
      if (!post) return next(new AppError('Post not found', 404));

      await User.findByIdAndUpdate(userId, {
        $addToSet: { savedPosts: { post: postId } }
      });

      res.status(200).json({ status: 'success', message: 'Post saved' });
    } catch (error) {
      next(error);
    }
  }

  async unsavePost(req, res, next) {
    try {
      const { postId } = req.params;
      const userId = req.user._id;

      await User.findByIdAndUpdate(userId, {
        $pull: { savedPosts: { post: postId } }
      });

      res.status(200).json({ status: 'success', message: 'Post unsaved' });
    } catch (error) {
      next(error);
    }
  }

  extractMentions(text) {
    if (!text) return [];
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    return [...new Set(mentions)]; // Remove duplicates
  }

  extractHashtags(text) {
    if (!text) return [];
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }
    return [...new Set(hashtags)]; // Remove duplicates
  }

  async canViewPost(post, user) {
    if (!user) return post.visibility === 'public';
    
    const userId = user._id.toString();
    const authorId = post.author.toString();

    // Author can always view
    if (userId === authorId) return true;

    // Admin can view all
    if (user.role === 'admin') return true;

    switch (post.visibility) {
      case 'public':
        return true;
      case 'friends':
      case 'followers':
        const author = await User.findById(authorId).select('followers');
        return author?.followers?.some(id => id.toString() === userId);
      case 'private':
        return false;
      case 'custom':
        return post.allowedViewers?.some(id => id.toString() === userId);
      default:
        return false;
    }
  }

  getUserReaction(post, userId) {
    if (!userId) return null;
    const userIdStr = userId.toString();
    
    for (const [reaction, users] of Object.entries(post.reactions)) {
      if (users.some(id => id.toString() === userIdStr)) {
        return reaction;
      }
    }
    return null;
  }
}

module.exports = new PostController();