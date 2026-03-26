const mongoose = require('mongoose');

const audioCommentSchema = new mongoose.Schema({
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    required: true,
    index: true,
  },
  
  // Audio File Info
  audio: {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    duration: Number, // بالثواني
    format: { type: String, enum: ['mp3', 'ogg', 'webm', 'm4a'] },
    size: Number, // بالبايت
    bitrate: Number,
  },
  
  // Speech-to-Text (مبتكر)
  transcription: {
    text: String,
    language: { type: String, default: 'auto-detected' },
    confidence: { type: Number, min: 0, max: 1 },
    processed: { type: Boolean, default: false },
    processedAt: Date,
    error: String,
  },
  
  // Voice Features (مبتكر)
  voiceAnalysis: {
    gender: { type: String, enum: ['male', 'female', 'unknown'] },
    ageEstimate: { type: String, enum: ['child', 'young', 'adult', 'senior'] },
    emotion: { 
      type: String, 
      enum: ['neutral', 'happy', 'sad', 'angry', 'excited', 'calm'] 
    },
  },
  
  // Accessibility (مبتكر)
  accessibility: {
    hasVisualWaveform: { type: Boolean, default: true },
    waveformData: [Number], // Array of amplitude values for visualization
    subtitlesGenerated: { type: Boolean, default: false },
  },
  
  // Engagement
  plays: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    count: { type: Number, default: 1 },
    lastPlayedAt: { type: Date, default: Date.now },
  }],
  playsCount: { type: Number, default: 0 },
  
  // Speed control (مبتكر - يسمح المستخدمين بتغيير سرعة التشغيل)
  defaultSpeed: { type: Number, default: 1.0, min: 0.5, max: 2.0 },
  
  // Quality variants
  variants: [{
    quality: { type: String, enum: ['low', 'medium', 'high', 'original'] },
    url: String,
    bitrate: Number,
  }],
  
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  
}, {
  timestamps: true,
});

// Index for transcription search
audioCommentSchema.index({ 'transcription.text': 'text' });

// Virtual for formatted duration
audioCommentSchema.virtual('formattedDuration').get(function() {
  const mins = Math.floor(this.audio.duration / 60);
  const secs = Math.floor(this.audio.duration % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
});

module.exports = mongoose.model('AudioComment', audioCommentSchema);