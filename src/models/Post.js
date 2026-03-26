const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    // Add these fields to postSchema

// After isStory field
sharedFrom: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Post',
},

// After aiTags field
moderationReason: String,
moderatedBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
},
moderatedAt: Date,
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  
  // Collaborative Posts
  coAuthors: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' }
  }],
  
  content: {
    text: {
      type: String,
      maxlength: 5000,
    },
    encrypted: { type: Boolean, default: false }, // للمحتوى المشفر
  },
  
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document'],
    },
    url: String,
    publicId: String,
    thumbnail: String,
    duration: Number, // للفيديو
    metadata: {
      width: Number,
      height: Number,
      size: Number,
      format: String,
    },
  }],
  
  // Engagement
  likes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
  likesCount: { type: Number, default: 0 },
  
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
  }],
  commentsCount: { type: Number, default: 0 },
  
  shares: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
  sharesCount: { type: Number, default: 0 },
  
  // ميزة مبتكرة: مشاعر/تفاعلات متعددة
  reactions: {
    like: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    love: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    laugh: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    angry: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    sad: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  
  // Visibility & Privacy
  visibility: {
    type: String,
    enum: ['public', 'friends', 'followers', 'private', 'custom'],
    default: 'public',
  },
  allowedViewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // للـ custom visibility
  
  // Group association
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  
  // ميزة مبتكرة: Geo-location (اختياري)
  location: {
    geoType: { type: String },  // GeoJSON type (e.g. 'Point') — renamed to avoid Mongoose conflict
    coordinates: { type: [Number], default: undefined },
    name: String,
    city: String,
    country: String,
  },
  
  // ميزة مبتكرة: Tags & Mentions
  mentions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    index: Number, // position in text
  }],
  hashtags: [{ type: String, index: true }],
  
  // ميزة مبتكرة: Polls
  poll: {
    question: String,
    options: [{
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    }],
    endDate: Date,
    totalVotes: { type: Number, default: 0 },
  },
  
  // ميزة مبتكرة: Content Warnings
  contentWarning: {
    enabled: { type: Boolean, default: false },
    category: {
      type: String,
      enum: ['sensitive', 'nsfw', 'violence', 'spoiler'],
    },
    description: String,
  },
  
  // ميزة مبتكرة: Post Expiry (Stories-like)
  expiresAt: Date,
  isStory: { type: Boolean, default: false },
  
  // AI Moderation
  moderationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending',
  },
  moderationScore: { type: Number, min: 0, max: 1 },
  aiTags: [String],
  sentimentScore: { type: Number, min: -1, max: 1 },
  
  // Metadata
  isEdited: { type: Boolean, default: false },
  editedAt: Date,
  language: String,
  
}, {
  timestamps: true,
});

// Indexes for Feed Performance
postSchema.index({ createdAt: -1, author: 1 });
postSchema.index({ hashtags: 1, createdAt: -1 });
// 2dsphere index is omitted — add it manually in production after ensuring all location docs have coordinates
// postSchema.index({ location: '2dsphere' }, { sparse: true });
postSchema.index({ 'poll.endDate': 1 });
postSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL for stories

// Compound index for feed generation
postSchema.index({ author: 1, createdAt: -1, visibility: 1 });

// Pre-save: remove invalid location (2dsphere requires coordinates)
postSchema.pre('save', function(next) {
  if (this.location && (!this.location.coordinates || this.location.coordinates.length === 0)) {
    this.location = undefined;
  }
  next();
});

// Virtual for engagement score (للـ Algorithm)
postSchema.virtual('engagementScore').get(function() {
  const hoursSincePosted = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  const decayFactor = Math.pow(0.5, hoursSincePosted / 24); // نصف العمر 24 ساعة
  
  return (
    (this.likesCount * 1) +
    (this.commentsCount * 2) +
    (this.sharesCount * 3)
  ) * decayFactor;
});

module.exports = mongoose.model('Post', postSchema);