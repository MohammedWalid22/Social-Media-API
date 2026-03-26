const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
    index: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Content can be text, audio, or sticker
  contentType: {
    type: String,
    enum: ['text', 'audio', 'mixed', 'sticker'],
    default: 'text',
  },
  
  // Text content (optional if audio or sticker)
  content: {
    type: String,
    maxlength: 2000,
    required: function() {
      return this.contentType === 'text';
    },
  },
  
  // Reference to sticker (when contentType is 'sticker')
  sticker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sticker',
  },
  
  // Reference to audio comment
  audioComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AudioComment',
  },
  
  // Nested Comments (Replies)
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
  }],
  
  // Reactions
  reactions: {
    like: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    love: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    laugh: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    angry: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  reactionsCount: { type: Number, default: 0 },
  
  // Awards/Tips
  awards: [{
    type: { type: String, enum: ['gold', 'silver', 'bronze'] },
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number,
    createdAt: { type: Date, default: Date.now },
  }],
  
  // Moderation
  isEdited: { type: Boolean, default: false },
  editedAt: Date,
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  
  // Audio-specific moderation (مبتكر)
  audioModeration: {
    status: { type: String, enum: ['pending', 'approved', 'flagged'], default: 'pending' },
    analyzedAt: Date,
    issues: [{
      type: { type: String, enum: ['hate_speech', 'profanity', 'violence', 'spam'] },
      confidence: Number,
      timestamp: Number, // في أي ثانية من التسجيل
    }],
  },
  
}, {
  timestamps: true,
});

commentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);