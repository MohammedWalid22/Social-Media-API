const mongoose = require('mongoose');

/**
 * Lightweight interaction history for Echo Chamber detection.
 * TTL: 30 days — old data is auto-deleted by MongoDB.
 */
const interactionHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    },
    hashtags: [{ type: String, lowercase: true, trim: true }],
    interactionType: {
      type: String,
      enum: ['like', 'comment', 'share', 'view'],
      required: true,
    },
    /** Snapshot of post sentiment at time of interaction */
    sentimentScore: { type: Number, min: -1, max: 1, default: 0 },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true, timestamps: false }
);

// TTL index: auto-delete after 30 days
interactionHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
interactionHistorySchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('InteractionHistory', interactionHistorySchema);
