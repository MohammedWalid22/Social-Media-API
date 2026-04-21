const mongoose = require('mongoose');

const webhookSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    /** List of events this webhook subscribes to */
    events: {
      type: [String],
      enum: [
        'post.created',
        'post.liked',
        'post.commented',
        'post.shared',
        'user.followed',
        'comment.added',
        'capsule.revealed',
      ],
      required: true,
    },
    /** HMAC-SHA256 secret — sent as X-Webhook-Signature header */
    secret: {
      type: String,
      required: true,
      select: false,
    },
    isActive: { type: Boolean, default: true },
    /** Auto-disable after 10 consecutive delivery failures */
    failureCount: { type: Number, default: 0 },
    lastTriggeredAt: Date,
    lastStatusCode: Number,
    description: { type: String, maxlength: 200 },
  },
  { timestamps: true }
);

webhookSchema.index({ owner: 1, isActive: 1 });
webhookSchema.index({ events: 1 }); // for fast event dispatch lookup

module.exports = mongoose.model('Webhook', webhookSchema);
