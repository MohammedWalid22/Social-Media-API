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
      results: [{ alternatives: [{ transcript: 'Mocked transcript' }] }]
    }])
  }))
}));

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
    console.log('✅ Test database disconnected');
  } catch (error) {
    console.error('❌ Error closing test database:', error);
  }
});

afterEach(async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  } catch (error) {
    console.error('❌ Error cleaning up collections:', error);
  }
});

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
  
  generateAuthToken: (userId) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { id: userId, iat: Date.now() },
      process.env.JWT_SECRET || 'test-secret'
    );
  },
};