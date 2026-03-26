const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceInfo: {
    type: String,
    required: true
  },
  ip: {
    type: String,
    required: true
  },
  token: {
    type: String,
    required: true,
    index: true
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  isValid: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Session', sessionSchema);
