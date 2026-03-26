const mongoose = require('mongoose');

const stickerSchema = new mongoose.Schema({
  // Sticker identity
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },

  // Category / Pack
  category: {
    type: String,
    enum: ['reactions', 'emotions', 'animals', 'memes', 'celebrations', 'love', 'sports', 'custom'],
    default: 'reactions',
  },
  pack: {
    type: String,
    trim: true,
    default: 'default',
  },

  // Media
  imageUrl: {
    type: String,
    required: true,
  },
  publicId: {
    type: String, // Cloudinary public_id for deletion
  },
  thumbnailUrl: {
    type: String, // Optional smaller thumbnail
  },
  isAnimated: {
    type: Boolean,
    default: false,
  },

  // Discoverability
  tags: [{ type: String, lowercase: true, trim: true }],
  emoji: { type: String }, // Optional emoji shorthand (e.g. "😂")

  // Moderation
  isOffensive: {
    type: Boolean,
    default: false,
  },
  moderatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  moderatedAt: Date,
  moderationReason: String,

  // Stats
  usageCount: { type: Number, default: 0 },
  collectCount: { type: Number, default: 0 },

  // Availability
  isActive: { type: Boolean, default: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Auto-generate slug from name
stickerSchema.pre('save', function (next) {
  if (!this.slug) {
    this.slug = this.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
  }
  next();
});

// Indexes
stickerSchema.index({ category: 1, isActive: 1 });
stickerSchema.index({ tags: 1 });
stickerSchema.index({ isOffensive: 1 });
stickerSchema.index({ name: 'text', tags: 'text' });

module.exports = mongoose.model('Sticker', stickerSchema);
