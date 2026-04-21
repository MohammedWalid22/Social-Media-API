const mongoose = require('mongoose');

/**
 * Privacy Audit Log — users can see who viewed their profile/posts.
 * TTL: 90 days — auto-deleted after 3 months.
 */
const privacyLogSchema = new mongoose.Schema(
  {
    /** The user whose data was accessed */
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** The user who performed the action (null = anonymous or system) */
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    event: {
      type: String,
      enum: [
        'profile_viewed',
        'post_viewed',
        'search_appeared',   // target appeared in someone's search results
        'follow_request_sent',
        'data_exported',
        'message_request_sent',
      ],
      required: true,
    },
    /** Where the action originated from */
    source: {
      type: String,
      enum: ['feed', 'search', 'direct', 'suggestion', 'profile', 'notification'],
      default: 'direct',
    },
    /** Optional reference to the resource (post, comment, etc.) */
    resource: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    resourceType: {
      type: String,
      enum: ['post', 'comment', 'profile', null],
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true, timestamps: false }
);

// TTL: auto-delete after 90 days
privacyLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
privacyLogSchema.index({ targetUser: 1, createdAt: -1 });
privacyLogSchema.index({ targetUser: 1, event: 1 });

module.exports = mongoose.model('PrivacyLog', privacyLogSchema);
