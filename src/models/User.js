const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    // Add these fields to the userSchema

// After verificationBadge field
isEmailVerified: { type: Boolean, default: false },
emailVerificationToken: String,
emailVerificationExpires: Date,

// After accountDeleted field
suspended: { type: Boolean, default: false },
suspendedAt: Date,
suspendedUntil: Date,
suspensionReason: String,

// After privacySettings
notificationPreferences: {
  email: { type: Boolean, default: true },
  push: { type: Boolean, default: true },
  muteTypes: [{ type: String }],
},

// Add role field after isVerified
role: {
  type: String,
  enum: ['user', 'moderator', 'admin'],
  default: 'user',
},
  // Authentication
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false,
  },
  
  // Profile
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    index: true,
  },
  displayName: {
    type: String,
    maxlength: 50,
  },
  bio: {
    type: String,
    maxlength: 500,
  },
  avatar: {
    url: String,
    publicId: String,
  },
  coverImage: {
    url: String,
    publicId: String,
  },
  
  // Privacy Settings (مبتكر)
  privacySettings: {
    profileVisibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'public',
    },
    postVisibility: {
      type: String,
      enum: ['public', 'friends', 'followers'],
      default: 'public',
    },
    allowTagging: { type: Boolean, default: true },
    allowMessages: {
      type: String,
      enum: ['everyone', 'friends', 'none'],
      default: 'friends',
    },
    showActivityStatus: { type: Boolean, default: true },
    dataSharing: { type: Boolean, default: false },
    positivityMode: { type: Boolean, default: false },
  },
  
  mutedWords: [{ type: String, trim: true, lowercase: true }],
  
  // Security
  twoFactorSecret: { type: String, select: false },
  twoFactorEnabled: { type: Boolean, default: false },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Number },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  
  // Relationships
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  // Personal Sticker Collection
  stickerCollection: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sticker',
  }],
  
  // Bookmarks / Saved Posts
  savedPosts: [{
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' },
    savedAt: { type: Date, default: Date.now }
  }],
  
  // Activity
  lastActive: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  
  // Validation & Gamification
  isVerified: { type: Boolean, default: false },
  verificationBadge: { type: String, enum: ['none', 'blue', 'gold', 'business'], default: 'none' },
  gamification: {
    points: { type: Number, default: 0 },
    badges: [{ type: String, enum: ['early_adopter', 'top_commenter', 'popular_writer', 'active_member'] }]
  },
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  
  // GDPR Compliance
  dataConsent: {
    given: { type: Boolean, default: false },
    date: Date,
    version: String,
  },
  accountDeleted: { type: Boolean, default: false },
  deletionScheduledAt: Date,
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for performance
userSchema.index({ username: 'text', displayName: 'text' });
userSchema.index({ createdAt: -1 });
// MongoDB doesn't allow a single compound index over two array fields.
// Use separate indexes for each array field instead.
userSchema.index({ followers: 1 });
userSchema.index({ following: 1 });


// Virtual for follower count
userSchema.virtual('followersCount').get(function() {
  return this.followers?.length || 0;
});

userSchema.virtual('followingCount').get(function() {
  return this.following?.length || 0;
});

// Pre-save middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// Methods
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);