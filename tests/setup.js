/* eslint-disable no-console */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const redis = require('../src/config/redis');

// Mock Google Cloud libraries globally
jest.mock('@google-cloud/language', () => ({
  LanguageServiceClient: jest.fn().mockImplementation(() => ({
    analyzeSentiment: jest.fn().mockResolvedValue([{
      documentSentiment: { score: 0.5, magnitude: 0.8 },
      sentences: [{}, {}]
    }])
  }))
}));

jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn().mockImplementation(() => ({
    recognize: jest.fn().mockResolvedValue([{
      results: [{ alternatives: [{ transcript: 'Mocked transcript', confidence: 0.99 }] }]
    }])
  }))
}));

jest.mock('fluent-ffmpeg', () => {
  const ffmpegMock = jest.fn(() => ({
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    audioFrequency: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    audioFilters: jest.fn().mockReturnThis(),
    format: jest.fn().mockReturnThis(),
    on: jest.fn(function(event, cb) {
      if (event === 'end') {
        setTimeout(cb, 10);
      }
      return this;
    }),
    save: jest.fn().mockReturnThis()
  }));
  ffmpegMock.setFfmpegPath = jest.fn();
  ffmpegMock.ffprobe = jest.fn((path, cb) => {
    cb(null, {
      format: {
        duration: 30,
        size: 1024,
        bit_rate: 128000,
        format_name: 'mp3',
      }
    });
  });
  return ffmpegMock;
});

let mongoServer;

// Increase timeout for all tests
jest.setTimeout(30000);

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Test database connected');
    
    // Mock Redis for tests
    jest.spyOn(redis, 'get').mockResolvedValue(null);
    jest.spyOn(redis, 'set').mockResolvedValue(true);
    jest.spyOn(redis, 'publish').mockResolvedValue(true);
    
  } catch (error) {
    console.error('❌ Test database connection failed:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
    const redisManager = require('../src/config/redis');
    if (redisManager && typeof redisManager.close === 'function') {
      await redisManager.close();
    }
    console.log('✅ Test database and Redis disconnected');
  } catch (error) {
    console.error('❌ Error closing test database/Redis:', error);
  }
});

// NOTE: We intentionally do NOT use a global afterEach cleanup here.
// Individual test files manage their own cleanup in beforeEach/afterAll.
// A global afterEach that wipes all collections breaks integration tests
// that rely on data persisting across multiple sequential `it` blocks.
// If you need cleanup between tests, do it in the specific test file.

// Global test utilities
global.testUtils = {
  createTestUser: async (overrides = {}) => {
    const User = require('../src/models/User');
    return await User.create({
      email: `test${Date.now()}@test.com`,
      password: 'Password123!',
      username: `testuser${Date.now()}`,
      ...overrides,
    });
  },
  
  generateAuthToken: async (userId) => {
    const jwt = require('jsonwebtoken');
    const Session = require('../src/models/Session');
    
    const token = jwt.sign(
      { id: userId, isTestToken: true, iat: Math.floor(Date.now() / 1000) },
      process.env.JWT_SECRET || 'test-secret'
    );
    
    // Create a valid session for the test token
    await Session.create({
      user: userId,
      deviceInfo: 'Test Environment',
      ip: '127.0.0.1',
      token,
      isValid: true,
      createdAt: new Date(),
    });
    
    return token;
  },
};