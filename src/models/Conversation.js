const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  
  // Last message for preview
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
  
  // Unread counts per user
  unreadCounts: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 0 },
  }],
  
  // Conversation settings
  settings: {
    isGroup: { type: Boolean, default: false },
    groupName: String,
    groupAvatar: String,
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  
  // Archive & Mute
  archivedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    until: Date,
  }],
  
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);