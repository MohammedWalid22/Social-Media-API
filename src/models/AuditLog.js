const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  action: {
    type: String,
    enum: [
      'USER_SIGNUP',
      'USER_LOGIN',
      'USER_LOGOUT',
      'PASSWORD_RESET',
      'PASSWORD_UPDATE',
      'EMAIL_CHANGE',
      'PRIVACY_SETTINGS_CHANGE',
      'ACCOUNT_DELETION_REQUESTED',
      'ACCOUNT_DELETED',
      'SUSPICIOUS_ACTIVITY',
      'DATA_EXPORT_REQUESTED',
      'CONTENT_MODERATION',
      'USER_SUSPENSION',
    ],
    required: true,
  },
  ip: String,
  userAgent: String,
  details: mongoose.Schema.Types.Mixed,
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    // ❌ شيل "index: true" من هنا
  },
}, {
  timestamps: true,
});

// ✅ سيب الـ index هنا بس
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);