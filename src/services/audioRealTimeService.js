const { Server } = require('socket.io');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');
const logger = require('../utils/logger');
const AudioProcessingService = require('./audioProcessingService');
const cloudinary = require('../config/cloudinary');

class AudioRealTimeService {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: (origin, callback) => {
          const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:3000',
            'http://localhost:5173',
          ];
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST'],
        credentials: true,
      },
      maxHttpBufferSize: 1e6, // 1MB
    });

    this.activeRecordings = new Map(); // userId -> recording session
    this.authMiddleware = require('../middleware/socketAuth');
    
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    // Apply auth middleware
    this.io.use(this.authMiddleware);

    this.io.on('connection', (socket) => {
      logger.info(`Audio client connected: ${socket.id}, User: ${socket.user?.username}`);

      // Start recording session
      socket.on('start-recording', (data) => {
        this.startRecording(socket, data);
      });

      // Receive audio chunks
      socket.on('audio-chunk', (chunk) => {
        this.handleAudioChunk(socket, chunk);
      });

      // Stop recording and process
      socket.on('stop-recording', () => {
        this.stopRecording(socket);
      });

      // Live transcription
      socket.on('request-transcription', () => {
        this.requestLiveTranscription(socket);
      });

      // Playback speed change
      socket.on('change-speed', (data) => {
        this.handleSpeedChange(socket, data);
      });

      socket.on('disconnect', () => {
        this.cleanup(socket);
        logger.info(`Audio client disconnected: ${socket.id}`);
      });

      // Error handling
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });
  }

  startRecording(socket, { postId, parentCommentId, quality = 'medium' }) {
    try {
      // Validate user
      if (!socket.user) {
        socket.emit('recording-error', { error: 'Not authenticated' });
        return;
      }

      // Check if already recording
      if (this.activeRecordings.has(socket.user._id.toString())) {
        socket.emit('recording-error', { error: 'Already recording' });
        return;
      }

      const sessionId = `rec_${socket.user._id}_${Date.now()}`;
      const tempFile = path.join(os.tmpdir(), `${sessionId}.webm`);
      const writeStream = fs.createWriteStream(tempFile);
      
      this.activeRecordings.set(socket.user._id.toString(), {
        sessionId,
        tempFile,
        writeStream,
        postId,
        parentCommentId,
        chunks: [],
        startTime: Date.now(),
        quality,
        socketId: socket.id,
      });

      socket.emit('recording-started', { 
        sessionId,
        maxDuration: 300000, // 5 minutes in ms
      });

      logger.info(`Recording started: ${sessionId} by ${socket.user.username}`);

    } catch (error) {
      logger.error('Start recording error:', error);
      socket.emit('recording-error', { error: 'Failed to start recording' });
    }
  }

  handleAudioChunk(socket, chunk) {
    try {
      const session = this.activeRecordings.get(socket.user?._id?.toString());
      if (!session) {
        socket.emit('recording-error', { error: 'No active recording' });
        return;
      }

      // Validate chunk
      if (!Buffer.isBuffer(chunk)) {
        // Convert base64 to buffer if needed
        chunk = Buffer.from(chunk, 'base64');
      }

      // Write chunk
      session.writeStream.write(chunk);
      session.chunks.push(chunk);

      // Calculate duration and size
      const duration = Date.now() - session.startTime;
      const size = session.chunks.reduce((acc, buf) => acc + buf.length, 0);

      // Send progress
      socket.emit('recording-progress', {
        duration,
        size,
        formattedDuration: this.formatDuration(duration),
      });

      // Auto-stop at 5 minutes
      if (duration > 300000) {
        this.stopRecording(socket);
      }

    } catch (error) {
      logger.error('Audio chunk error:', error);
      socket.emit('recording-error', { error: 'Failed to process audio chunk' });
    }
  }

  async stopRecording(socket) {
    const userId = socket.user?._id?.toString();
    const session = this.activeRecordings.get(userId);
    
    if (!session) {
      socket.emit('recording-error', { error: 'No active recording' });
      return;
    }

    try {
      session.writeStream.end();
      socket.emit('processing-started');

      // Process the recorded file
      const result = await this.processRecordedAudio(session, socket.user);

      // Create comment in database
      const Comment = require('../models/Comment');
      const AudioComment = require('../models/AudioComment');
      const Post = require('../models/Post');
      const NotificationService = require('./notificationService');

      const comment = await Comment.create({
        post: session.postId,
        author: socket.user._id,
        content: result.textAccompaniment || '[Audio Comment]',
        contentType: result.textAccompaniment ? 'mixed' : 'audio',
        parentComment: session.parentCommentId || null,
      });

      const audioComment = await AudioComment.create({
        comment: comment._id,
        audio: {
          url: result.url,
          publicId: result.publicId,
          duration: result.duration,
          format: result.format,
          size: result.size,
          bitrate: result.bitrate,
        },
        accessibility: {
          waveformData: result.waveformData,
        },
        variants: result.variants,
      });

      comment.audioComment = audioComment._id;
      await comment.save();

      // Update post
      await Post.findByIdAndUpdate(session.postId, {
        $push: { comments: comment._id },
        $inc: { commentsCount: 1 },
      });

      // Notify post author
      const post = await Post.findById(session.postId);
      if (post && post.author.toString() !== socket.user._id.toString()) {
        await NotificationService.create({
          recipient: post.author,
          sender: socket.user._id,
          type: session.parentCommentId ? 'reply' : 'comment',
          post: session.postId,
          comment: comment._id,
          message: 'New audio comment',
        });
      }

      // Populate and send result
      await comment.populate([
        { path: 'author', select: 'username displayName avatar' },
        { path: 'audioComment' },
      ]);

      socket.emit('recording-complete', {
        success: true,
        comment: {
          ...comment.toObject(),
          audioComment: {
            ...audioComment.toObject(),
            formattedDuration: audioComment.formattedDuration,
          },
        },
      });

      logger.info(`Recording completed: ${session.sessionId}`);

    } catch (error) {
      logger.error('Stop recording error:', error);
      socket.emit('recording-error', { error: 'Failed to process recording' });
    } finally {
      // Cleanup
      this.cleanupSession(userId, session);
    }
  }

  async processRecordedAudio(session, user) {
    try {
      // Process with AudioProcessingService
      const processed = await AudioProcessingService.processAudio(
        session.tempFile,
        { bitrate: this.getBitrateForQuality(session.quality) }
      );

      // Upload to cloudinary
      const uploadResult = await cloudinary.uploader.upload(session.tempFile, {
        folder: 'audio-comments',
        resource_type: 'video', // Cloudinary treats audio as video
        public_id: `audio_${user._id}_${Date.now()}`,
      });

      return {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        duration: processed.duration,
        format: 'mp3',
        size: processed.size,
        bitrate: processed.bitrate,
        waveformData: processed.waveformData,
        variants: processed.variants,
        textAccompaniment: session.textAccompaniment,
      };

    } catch (error) {
      throw error;
    }
  }

  async requestLiveTranscription(socket) {
    // TODO: Implement live transcription with Google Speech-to-Text streaming
    socket.emit('transcription-status', { status: 'not-implemented' });
  }

  handleSpeedChange(socket, { speed }) {
    // Validate speed
    if (speed < 0.5 || speed > 2.0) {
      socket.emit('speed-error', { error: 'Speed must be between 0.5x and 2.0x' });
      return;
    }

    socket.emit('speed-changed', { speed });
  }

  cleanup(socket) {
    const userId = socket.user?._id?.toString();
    if (userId && this.activeRecordings.has(userId)) {
      const session = this.activeRecordings.get(userId);
      this.cleanupSession(userId, session);
    }
  }

  cleanupSession(userId, session) {
    try {
      if (session.writeStream) {
        session.writeStream.end();
      }
      if (fs.existsSync(session.tempFile)) {
        fs.unlinkSync(session.tempFile);
      }
    } catch (err) {
      logger.error('Cleanup error:', err);
    } finally {
      this.activeRecordings.delete(userId);
    }
  }

  getBitrateForQuality(quality) {
    const bitrates = {
      low: 64,
      medium: 128,
      high: 192,
    };
    return bitrates[quality] || 128;
  }

  formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get IO instance for use in other services
  getIO() {
    return this.io;
  }
}

module.exports = AudioRealTimeService;