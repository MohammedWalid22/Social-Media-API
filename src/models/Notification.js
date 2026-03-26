const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'follow',
      'follow_request',
      'follow_request_accepted',
      'like',
      'comment',
      'reply',
      'mention',
      'message',
      'post_share',
      'comment_like',
    ],
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
  },
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  read: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  
  // Grouping similar notifications
  groupKey: String,
  groupCount: { type: Number, default: 1 },
  
  // Click action
  actionUrl: String,
}, {
  timestamps: true,
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);