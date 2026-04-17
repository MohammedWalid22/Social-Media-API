
// Mock LanguageServiceClient
jest.mock('@google-cloud/language', () => {
  const mClient = {
    analyzeSentiment: jest.fn(),
    classifyText: jest.fn(),
  };
  return { LanguageServiceClient: jest.fn(() => mClient) };
});

const audioModerationService = require('../src/services/audioModerationService');

describe('AudioModerationService Unit Tests', () => {
  let languageClientMock;

  beforeEach(() => {
    jest.clearAllMocks();
    languageClientMock = audioModerationService.languageClient;
  });

  describe('moderateAudio', () => {
    it('should return approved when no issues found', async () => {
      // Mock analyzeText directly or through dependent mock
      languageClientMock.analyzeSentiment.mockResolvedValue([{ documentSentiment: { score: 0.5 } }]);
      languageClientMock.classifyText.mockResolvedValue([{ categories: [] }]);

      const result = await audioModerationService.moderateAudio('url', 'clean text');
      
      expect(result.status).toBe('approved');
      expect(result.issues).toHaveLength(0);
    });

    it('should return rejected for high confidence issues', async () => {
      // Toxic sentiment and Adult category
      languageClientMock.analyzeSentiment.mockResolvedValue([{ documentSentiment: { score: -0.9 } }]);
      languageClientMock.classifyText.mockResolvedValue([{ categories: [{ name: '/Adult', confidence: 0.95 }] }]);

      const result = await audioModerationService.moderateAudio('url', 'bad text');
      
      expect(result.status).toBe('rejected');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should return flagged for low confidence issues', async () => {
      languageClientMock.analyzeSentiment.mockResolvedValue([{ documentSentiment: { score: 0.5 } }]);
      languageClientMock.classifyText.mockResolvedValue([{ categories: [{ name: '/Adult', confidence: 0.5 }] }]);

      const result = await audioModerationService.moderateAudio('url', 'maybe bad text');
      
      expect(result.status).toBe('flagged');
      expect(result.issues).toHaveLength(1);
    });

    it('should handle screaming audio pattern', async () => {
      jest.spyOn(audioModerationService, 'analyzeAudioPatterns').mockResolvedValueOnce({
        hasScreaming: true,
        screamingConfidence: 0.9,
        timestamp: 12
      });
      languageClientMock.analyzeSentiment.mockResolvedValue([{ documentSentiment: { score: 0 } }]);
      languageClientMock.classifyText.mockResolvedValue([{ categories: [] }]);

      const result = await audioModerationService.moderateAudio('url', 'text');
      
      expect(result.status).toBe('rejected'); // because confidence is 0.9 > 0.8
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'violence', confidence: 0.9 })
        ])
      );
    });

    it('should return pending with error when analysis fails', async () => {
      languageClientMock.analyzeSentiment.mockRejectedValue(new Error('API failure'));
      
      const result = await audioModerationService.moderateAudio('url', 'text');
      
      expect(result.status).toBe('pending');
      expect(result.error).toBe('API failure');
    });
  });

  describe('analyzeText', () => {
    it('should detect toxicity from sentiment score', async () => {
      languageClientMock.analyzeSentiment.mockResolvedValue([{ documentSentiment: { score: -0.8 } }]);
      languageClientMock.classifyText.mockResolvedValue([{ categories: [] }]);

      const result = await audioModerationService.analyzeText('terrible text');
      
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('toxicity');
      expect(result.issues[0].confidence).toBe(0.8); // Math.abs(-0.8)
    });

    it('should detect hate speech / profanity from categories', async () => {
      languageClientMock.analyzeSentiment.mockResolvedValue([{ documentSentiment: { score: 0.1 } }]);
      languageClientMock.classifyText.mockResolvedValue([{ categories: [
        { name: '/Adult', confidence: 0.8 },
        { name: '/Violence', confidence: 0.7 }
      ] }]);

      const result = await audioModerationService.analyzeText('text');
      
      expect(result.issues).toHaveLength(2);
      expect(result.issues.map(i => i.type)).toContain('profanity');
      expect(result.issues.map(i => i.type)).toContain('hate_speech');
    });
  });

  describe('analyzeAudioPatterns', () => {
    it('should return default pattern object', async () => {
      const result = await audioModerationService.analyzeAudioPatterns();
      expect(result).toEqual({ hasScreaming: false, screamingConfidence: 0, timestamp: 0 });
    });
  });

  describe('detectSpamAudio', () => {
    it('should detect excessive repetition', () => {
      // 15 words, but only 2 unique words. repetitionRatio = 2/15 = 0.13 < 0.3
      const text = 'spam spam spam spam spam spam spam spam spam spam spam spam spam spam spam';
      const issues = audioModerationService.detectSpamAudio(text, 10);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].reason).toBe('excessive_repetition');
    });

    it('should detect excessive silence', () => {
      // 3 words, duration 40s
      const text = 'hello world there';
      const issues = audioModerationService.detectSpamAudio(text, 40);
      
      expect(issues).toHaveLength(1);
      expect(issues[0].reason).toBe('excessive_silence');
    });

    it('should return no issues for normal audio', () => {
      const text = 'this is a completely normal sentence with different words';
      const issues = audioModerationService.detectSpamAudio(text, 10);
      
      expect(issues).toHaveLength(0);
    });
  });
});
