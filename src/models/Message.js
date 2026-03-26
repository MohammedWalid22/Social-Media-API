const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  
  // Encrypted Content (E2EE)
  content: {
    encryptedData: String,
    iv: String,
    authTag: String,
  },
  
  // Metadata (غير مشفرة للبحث)
  metadata: {
    hasMedia: { type: Boolean, default: false },
    mediaType: { type: String, enum: ['image', 'video', 'file', 'voice'] },
    messageType: {
      type: String,
      enum: ['text', 'media', 'voice', 'location', 'contact'],
      default: 'text',
    },
  },
  
  // ميزة مبتكرة: Self-destructing messages
  selfDestruct: {
    enabled: { type: Boolean, default: false },
    duration: Number, // seconds
    viewedAt: Date,
  },
  
  // Status
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read', 'failed'],
    default: 'sent',
  },
  readAt: Date,
  deliveredAt: Date,
  
  // ميزة مبتكرة: Reply to message
  replyTo: {
    messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    preview: String,
  },
  
  // ميزة مبتكرة: Reactions
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
    createdAt: { type: Date, default: Date.now },
  }],
  
  // Deletion
  deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  deletedForEveryone: { type: Boolean, default: false },
  deletedAt: Date,
  
}, {
  timestamps: true,
});

// Indexes for conversation loading
messageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model('Message', messageSchema);