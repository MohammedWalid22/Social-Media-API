const fs = require('fs/promises');
const Comment = require('../models/Comment');
const AudioComment = require('../models/AudioComment');
const Post = require('../models/Post');
const Sticker = require('../models/Sticker');
const AudioProcessingService = require('../services/audioProcessingService');
const AudioModerationService = require('../services/audioModerationService');
const NotificationService = require('../services/notificationService');
const GamificationService = require('../services/gamificationService');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');

class CommentController {
  /**
   * Create text comment
   */
  createComment = async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { content, parentCommentId } = req.body;

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({
          status: 'fail',
          message: 'Post not found',
        });
      }

      const comment = await Comment.create({
        post: postId,
        author: req.user._id,
        content,
        contentType: 'text',
        parentComment: parentCommentId || null,
      });

      // Update post
      post.comments.push(comment._id);
      post.commentsCount += 1;
      await post.save();

      if (parentCommentId) {
        await Comment.findByIdAndUpdate(parentCommentId, {
          $push: { replies: comment._id },
        });
      }

      // Notify
      if (post.author.toString() !== req.user._id.toString()) {
        await NotificationService.create({
          recipient: post.author,
          sender: req.user._id,
          type: parentCommentId ? 'reply' : 'comment',
          post: postId,
          comment: comment._id,
        });
      }

      await comment.populate('author', 'username displayName avatar');

      // Gamification: 5 points for commenting
      GamificationService.addPoints(req.user._id, 5).catch(err => logger.error('Gamification error:', err));

      res.status(201).json({
        status: 'success',
        data: { comment },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create sticker comment on a post
   * — Auto-moderates: if sticker is offensive, comment is immediately rejected.
   */
  createStickerComment = async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { stickerId, parentCommentId } = req.body;

      if (!stickerId) {
        return res.status(400).json({ status: 'fail', message: 'stickerId is required' });
      }

      // Verify post exists
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({ status: 'fail', message: 'Post not found' });
      }

      // Verify sticker exists and is active
      const sticker = await Sticker.findById(stickerId);
      if (!sticker || !sticker.isActive) {
        return res.status(404).json({ status: 'fail', message: 'Sticker not found' });
      }

      // Determine moderation status based on sticker flag
      const moderationStatus = sticker.isOffensive ? 'rejected' : 'approved';

      // Create the sticker comment
      const comment = await Comment.create({
        post: postId,
        author: req.user._id,
        content: `[Sticker: ${sticker.name}]`,
        contentType: 'sticker',
        sticker: stickerId,
        parentComment: parentCommentId || null,
        moderationStatus,
      });

      // If sticker is offensive — return immediately without updating counts
      if (sticker.isOffensive) {
        logger.warn(`Sticker comment rejected (offensive sticker): user=${req.user._id}, sticker=${stickerId}`);
        return res.status(400).json({
          status: 'fail',
          message: 'This sticker has been flagged as inappropriate and cannot be used.',
        });
      }

      // Update sticker usage stats
      await Sticker.findByIdAndUpdate(stickerId, { $inc: { usageCount: 1 } });

      // Update post comment count
      post.comments.push(comment._id);
      post.commentsCount += 1;
      await post.save();

      // Update parent comment thread if it's a reply
      if (parentCommentId) {
        await Comment.findByIdAndUpdate(parentCommentId, {
          $push: { replies: comment._id },
        });
      }

      // Notify post author
      if (post.author.toString() !== req.user._id.toString()) {
        await NotificationService.create({
          recipient: post.author,
          sender: req.user._id,
          type: parentCommentId ? 'reply' : 'comment',
          post: postId,
          comment: comment._id,
          message: `reacted with a sticker: ${sticker.emoji || sticker.name}`,
        });
      }

      await comment.populate([
        { path: 'author', select: 'username displayName avatar' },
        { path: 'sticker', select: 'name imageUrl thumbnailUrl category emoji isAnimated' },
      ]);

      res.status(201).json({
        status: 'success',
        data: { comment },
      });
    } catch (error) {
      next(error);
    }
  };
  /**
   * Create audio comment (ميزة جديدة)
   */
  createAudioComment = async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { parentCommentId, textAccompaniment } = req.body;
      
      if (!req.file) {
        return res.status(400).json({
          status: 'fail',
          message: 'Audio file is required',
        });
      }

      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({
          status: 'fail',
          message: 'Post not found',
        });
      }

      // Check audio duration (limit to 5 minutes)
      const metadata = await AudioProcessingService.getAudioMetadata(req.file.path);
      if (metadata.duration > 300) {
        return res.status(400).json({
          status: 'fail',
          message: 'Audio comment must be less than 5 minutes',
        });
      }

      // Process audio (compress, generate waveform, etc.)
      const audioData = await AudioProcessingService.processAudio(req.file.path, {
        bitrate: 128,
      });

      // Create main comment record
      const comment = await Comment.create({
        post: postId,
        author: req.user._id,
        content: textAccompaniment || '[Audio Comment]', 
        contentType: textAccompaniment ? 'mixed' : 'audio',
        parentComment: parentCommentId || null,
      });

      // Create audio comment record
      const audioComment = await AudioComment.create({
        comment: comment._id,
        audio: {
          url: audioData.url,
          publicId: audioData.publicId,
          duration: audioData.duration,
          format: audioData.format,
          size: audioData.size,
          bitrate: audioData.bitrate,
        },
        accessibility: {
          waveformData: audioData.waveformData,
        },
        variants: audioData.variants,
      });

      // Link audio to comment
      comment.audioComment = audioComment._id;
      await comment.save();

      // Process transcription asynchronously (الآن 'this' ستعمل بشكل صحيح)
      this.processTranscriptionAsync(audioComment._id, audioData.url);

      // Update post
      post.comments.push(comment._id);
      post.commentsCount += 1;
      await post.save();

      if (parentCommentId) {
        await Comment.findByIdAndUpdate(parentCommentId, {
          $push: { replies: comment._id },
        });
      }

      // Notify post author
      if (post.author.toString() !== req.user._id.toString()) {
        await NotificationService.create({
          recipient: post.author,
          sender: req.user._id,
          type: parentCommentId ? 'reply' : 'comment',
          post: postId,
          comment: comment._id,
          message: 'New audio comment',
        });
      }

      await comment.populate([
        { path: 'author', select: 'username displayName avatar' },
        { path: 'audioComment' },
      ]);

      res.status(201).json({
        status: 'success',
        data: { 
          comment: {
            ...comment.toObject(),
            audioComment: {
              ...audioComment.toObject(),
              formattedDuration: audioComment.formattedDuration,
            },
          },
        },
      });
    } catch (error) {
      // Cleanup uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {});
      }
      next(error);
    }
  };

  /**
   * Process transcription in background
   */
  processTranscriptionAsync = async (audioCommentId, audioUrl) => {
    try {
      // Transcribe
      const transcription = await AudioProcessingService.transcribeAudio(audioUrl);
      
      // Update audio comment with transcription
      await AudioComment.findByIdAndUpdate(audioCommentId, {
        transcription,
        'accessibility.subtitlesGenerated': !!transcription.text,
      });

      // Moderate content
      const moderation = await AudioModerationService.moderateAudio(
        audioUrl,
        transcription.text
      );

      // Update comment moderation status
      const audioComment = await AudioComment.findById(audioCommentId);
      const comment = await Comment.findById(audioComment.comment);
      
      comment.audioModeration = moderation;
      
      if (moderation.status === 'rejected') {
        comment.moderationStatus = 'rejected';
        // Notify user of rejection
        await NotificationService.create({
          recipient: comment.author,
          type: 'content_rejected',
          message: 'Your audio comment was removed due to inappropriate content',
        });
      }
      
      await comment.save();

      // Analyze voice features (optional)
      const voiceAnalysis = await AudioProcessingService.analyzeVoice(audioUrl);
      await AudioComment.findByIdAndUpdate(audioCommentId, { voiceAnalysis });

    } catch (error) {
      logger.error('Async transcription processing failed:', error);
    }
  };

  /**
   * Get comments with audio support
   */
  getComments = async (req, res, next) => {
    try {
      const { postId } = req.params;
      const { page = 1, limit = 20, sort = 'newest', type = 'all' } = req.query;

      const sortOptions = {
        newest: { createdAt: -1 },
        oldest: { createdAt: 1 },
        popular: { reactionsCount: -1, createdAt: -1 },
      };

      const query = {
        post: postId,
        parentComment: null,
        moderationStatus: { $ne: 'rejected' },
      };

      // Filter by type
      if (type === 'text') query.contentType = 'text';
      if (type === 'audio') query.contentType = { $in: ['audio', 'mixed'] };

      const comments = await Comment.find(query)
        .sort(sortOptions[sort] || sortOptions.newest)
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('author', 'username displayName avatar isVerified')
        .populate({
          path: 'audioComment',
          select: '-__v -createdAt -updatedAt',
        })
        .populate({
          path: 'replies',
          populate: [
            { path: 'author', select: 'username displayName avatar' },
            { path: 'audioComment', select: 'audio.duration audio.url transcription.text accessibility.waveformData' },
          ],
          options: { limit: 3 },
        });

      // Add formatted duration and check if user has played audio
      const enrichedComments = comments.map(comment => {
        const obj = comment.toObject();
        if (obj.audioComment) {
          obj.audioComment.formattedDuration = obj.audioComment.audio?.duration 
            ? `${Math.floor(obj.audioComment.audio.duration / 60)}:${Math.floor(obj.audioComment.audio.duration % 60).toString().padStart(2, '0')}`
            : '0:00';
          
          // Check if current user has played this
          obj.audioComment.hasPlayed = obj.audioComment.plays?.some(
            p => p.user.toString() === req.user._id.toString()
          ) || false;
        }
        return obj;
      });

      res.status(200).json({
        status: 'success',
        results: comments.length,
        data: { comments: enrichedComments },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Record audio play (مبتكر - تتبع الاستماع)
   */
  recordAudioPlay = async (req, res, next) => {
    try {
      const { audioCommentId } = req.params;
      const userId = req.user._id;

      const audioComment = await AudioComment.findById(audioCommentId);
      if (!audioComment) {
        return res.status(404).json({
          status: 'fail',
          message: 'Audio comment not found',
        });
      }

      // Update or insert play record
      const existingPlay = audioComment.plays.find(
        p => p.user.toString() === userId.toString()
      );

      if (existingPlay) {
        existingPlay.count += 1;
        existingPlay.lastPlayedAt = new Date();
      } else {
        audioComment.plays.push({
          user: userId,
          count: 1,
          lastPlayedAt: new Date(),
        });
        audioComment.playsCount += 1;
      }

      await audioComment.save();

      res.status(200).json({
        status: 'success',
        data: {
          playsCount: audioComment.playsCount,
          userPlays: existingPlay ? existingPlay.count : 1,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get audio transcription (للأشخاص ذوي الإعاقة السمعية)
   */
  getTranscription = async (req, res, next) => {
    try {
      const { audioCommentId } = req.params;

      const audioComment = await AudioComment.findById(audioCommentId)
        .select('transcription audio.duration');

      if (!audioComment) {
        return res.status(404).json({
          status: 'fail',
          message: 'Audio comment not found',
        });
      }

      if (!audioComment.transcription?.processed) {
        return res.status(202).json({
          status: 'pending',
          message: 'Transcription is still being processed',
        });
      }

      res.status(200).json({
        status: 'success',
        data: {
          text: audioComment.transcription.text,
          language: audioComment.transcription.language,
          confidence: audioComment.transcription.confidence,
          words: audioComment.transcription.words, 
          duration: audioComment.audio.duration,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update audio playback speed (تفضيل المستخدم)
   */
  updatePlaybackSpeed = async (req, res, next) => {
    try {
      const { audioCommentId } = req.params;
      const { speed } = req.body;

      if (speed < 0.5 || speed > 2.0) {
        return res.status(400).json({
          status: 'fail',
          message: 'Speed must be between 0.5x and 2.0x',
        });
      }

      await AudioComment.findByIdAndUpdate(audioCommentId, {
        defaultSpeed: speed,
      });

      res.status(200).json({
        status: 'success',
        data: { speed },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Toggle reaction on comment
   */
  reactToComment = async (req, res, next) => {
    try {
      const { commentId } = req.params;
      const { reaction = 'like' } = req.body;
      const userId = req.user._id;

      const validReactions = ['like', 'love', 'laugh', 'angry', 'sad'];
      if (!validReactions.includes(reaction)) {
        return res.status(400).json({ status: 'fail', message: 'Invalid reaction type' });
      }

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({
          status: 'fail',
          message: 'Comment not found',
        });
      }

      // Check for existing reaction and remove
      let existingReactionType = null;
      for (const type of validReactions) {
        const index = comment.reactions[type].indexOf(userId);
        if (index !== -1) {
          comment.reactions[type].splice(index, 1);
          comment.reactionsCount = Math.max(0, comment.reactionsCount - 1);
          existingReactionType = type;
          break;
        }
      }

      let isAdded = false;
      // If the user clicked a different reaction (or it's new), add it
      if (existingReactionType !== reaction) {
        comment.reactions[reaction].push(userId);
        comment.reactionsCount += 1;
        isAdded = true;
      }

      await comment.save();

      // Gamification: 1 point for reacting (only if new reaction, not just changing)
      if (isAdded && existingReactionType === null) {
        GamificationService.addPoints(userId, 1).catch(err => logger.error('Gamification error:', err));
      }

      res.status(200).json({
        status: 'success',
        data: {
          reactionsCount: comment.reactionsCount,
          reaction: isAdded ? reaction : null,
          reactions: comment.reactions,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete comment (with audio cleanup)
   */
  deleteComment = async (req, res, next) => {
    try {
      const { commentId } = req.params;

      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({
          status: 'fail',
          message: 'Comment not found',
        });
      }

      const post = await Post.findById(comment.post);
      const isAuthorized = 
        comment.author.toString() === req.user._id.toString() ||
        post.author.toString() === req.user._id.toString() ||
        req.user.role === 'admin';

      if (!isAuthorized) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized to delete this comment',
        });
      }

      // If audio comment, delete from cloud storage
      if (comment.audioComment) {
        const audioComment = await AudioComment.findById(comment.audioComment);
        if (audioComment) {
          // Delete from Cloudinary or GCS
          await cloudinary.uploader.destroy(audioComment.audio.publicId, {
            resource_type: 'video', // audio treated as video in cloudinary
          });
          
          // Delete variants (يجب إضافة اللوجيك الخاص بك هنا لاحقاً)
          for (const variant of audioComment.variants || []) {
            // Extract public_id from URL and delete
          }
          
          audioComment.isDeleted = true;
          audioComment.deletedAt = new Date();
          await audioComment.save();
        }
      }

      comment.content = '[deleted]';
      comment.isDeleted = true;
      await comment.save();

      // Update counts
      post.commentsCount = Math.max(0, post.commentsCount - 1);
      await post.save();

      res.status(204).json({
        status: 'success',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new CommentController();