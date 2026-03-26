const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  content: {
    type: {
      type: String,
      enum: ['image', 'video', 'text', 'audio'],
      required: true,
    },
    url: String,
    text: String,
    backgroundColor: String,
    font: String,
  },
  
  // Viewers
  viewers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    viewedAt: { type: Date, default: Date.now },
    reaction: { type: String, enum: ['like', 'love', 'laugh', 'sad'] },
  }],
  
  // Settings
  settings: {
    allowReplies: { type: Boolean, default: true },
    allowSharing: { type: Boolean, default: true },
    hideFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Close friends feature
  },
  
  // Auto-expire
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  
  // Highlights
  isHighlight: { type: Boolean, default: false },
  highlightName: String,
  
}, {
  timestamps: true,
});

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Story', storySchema);