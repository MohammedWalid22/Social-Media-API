const { LanguageServiceClient } = require('@google-cloud/language');
const logger = require('../utils/logger');

class ContentModeration {
  constructor() {
    this.languageClient = null;
    
    // Lazy initialization
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        this.languageClient = new LanguageServiceClient();
      } catch (err) {
        logger.warn('Google Cloud Language client init failed:', err);
      }
    }
  }

  async analyze(text, media = []) {
    const result = {
      severity: 'low', // low, medium, high
      score: 0,
      categories: [],
      textAnalysis: null,
    };

    try {
      // Text analysis
      if (text && this.languageClient) {
        const textResult = await this.analyzeText(text);
        result.textAnalysis = textResult;
        
        if (textResult.toxicity > 0.8) {
          result.severity = 'high';
          result.categories.push('toxicity');
        } else if (textResult.toxicity > 0.5) {
          result.severity = 'medium';
          result.categories.push('toxicity');
        }
        
        result.score = textResult.toxicity;
      }

      // TODO: Media analysis (images, video)
      
      return result;
    } catch (error) {
      logger.error('Content moderation error:', error);
      // Fail open - allow content if analysis fails
      return { severity: 'low', score: 0, categories: [], error: error.message };
    }
  }

  async analyzeText(text) {
    try {
      const document = {
        content: text.substring(0, 5000), // Limit size
        type: 'PLAIN_TEXT',
      };

      const [sentiment] = await this.languageClient.analyzeSentiment({ document });
      
      // Check for negative sentiment as toxicity indicator
      const toxicity = Math.abs(sentiment.documentSentiment.score) > 0.6 
        ? Math.abs(sentiment.documentSentiment.score) 
        : 0;

      return {
        toxicity,
        sentiment: sentiment.documentSentiment.score,
        entities: sentiment.sentences.length,
      };
    } catch (error) {
      logger.error('Text analysis error:', error);
      return { toxicity: 0, sentiment: 0, entities: 0 };
    }
  }

  // Simple rule-based check (fallback)
  ruleBasedCheck(text) {
    const bannedWords = process.env.BANNED_WORDS?.split(',') || [];
    const lowerText = text.toLowerCase();
    
    const found = bannedWords.filter(word => lowerText.includes(word.trim()));
    
    return {
      hasViolation: found.length > 0,
      violations: found,
    };
  }
}

module.exports = new ContentModeration();