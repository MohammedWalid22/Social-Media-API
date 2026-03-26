const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { LanguageServiceClient } = require('@google-cloud/language');

class AudioModerationService {
  constructor() {
    this.languageClient = new LanguageServiceClient();
  }

  /**
   * Analyze audio content for inappropriate material
   */
  async moderateAudio(audioUrl, transcriptionText) {
    const results = {
      status: 'approved',
      issues: [],
      analyzedAt: new Date(),
    };

    try {
      // 1. Analyze transcription text
      if (transcriptionText) {
        const textAnalysis = await this.analyzeText(transcriptionText);
        results.issues.push(...textAnalysis.issues);
      }

      // 2. Check audio patterns (volume spikes, etc.)
      const audioPatterns = await this.analyzeAudioPatterns(audioUrl);
      if (audioPatterns.hasScreaming) {
        results.issues.push({
          type: 'violence',
          confidence: audioPatterns.screamingConfidence,
          timestamp: audioPatterns.timestamp,
        });
      }

      // Determine final status
      const highConfidenceIssues = results.issues.filter(i => i.confidence > 0.8);
      if (highConfidenceIssues.length > 0) {
        results.status = 'rejected';
      } else if (results.issues.length > 0) {
        results.status = 'flagged';
      }

      return results;
    } catch (error) {
      return {
        status: 'pending',
        issues: [],
        error: error.message,
        analyzedAt: new Date(),
      };
    }
  }

  /**
   * Analyze text using Google Natural Language API
   */
  async analyzeText(text) {
    const document = {
      content: text,
      type: 'PLAIN_TEXT',
    };

    const [sentiment] = await this.languageClient.analyzeSentiment({ document });
    const [classification] = await this.languageClient.classifyText({ document });
    
    const issues = [];

    // Check sentiment (highly negative might indicate toxicity)
    if (sentiment.documentSentiment.score < -0.6) {
      issues.push({
        type: 'toxicity',
        confidence: Math.abs(sentiment.documentSentiment.score),
        timestamp: 0,
      });
    }

    // Check categories
    const sensitiveCategories = ['/Adult', '/Violence', '/Hate'];
    classification.categories.forEach(cat => {
      if (sensitiveCategories.some(sc => cat.name.includes(sc))) {
        issues.push({
          type: cat.name.toLowerCase().includes('adult') ? 'profanity' : 'hate_speech',
          confidence: cat.confidence,
          timestamp: 0,
        });
      }
    });

    return { issues };
  }

  /**
   * Analyze audio patterns for violence indicators
   */
  async analyzeAudioPatterns(audioUrl) {
    // Implementation would analyze volume levels, frequency patterns
    // to detect screaming, gunshots, etc.
    return {
      hasScreaming: false,
      screamingConfidence: 0,
      timestamp: 0,
    };
  }

  /**
   * Detect spam audio (repeated content, etc.)
   */
  detectSpamAudio(transcription, duration) {
    const issues = [];
    
    // Check for excessive repetition
    const words = transcription.split(' ');
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    
    if (repetitionRatio < 0.3 && words.length > 10) {
      issues.push({
        type: 'spam',
        confidence: 0.7,
        reason: 'excessive_repetition',
      });
    }

    // Check for very short audio with long duration (silence)
    if (duration > 30 && words.length < 5) {
      issues.push({
        type: 'spam',
        confidence: 0.6,
        reason: 'excessive_silence',
      });
    }

    return issues;
  }
}

module.exports = new AudioModerationService();