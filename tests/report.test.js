const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Report = require('../src/models/Report');

let authToken;
let targetPostId;

describe('Reports Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Report.deleteMany({});

    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'reporter@test.com',
        password: 'Password123!',
        username: 'reporter',
        displayName: 'Reporter User',
      });

    authToken = signupRes.body.token;
    targetPostId = new mongoose.Types.ObjectId().toString();
  });

  describe('POST /api/v1/reports', () => {
    it('should create a report for a post', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetType: 'Post',       // PascalCase to match model enum
          targetId: targetPostId,
          reason: 'spam',
          description: 'This is clearly spam content',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.report.reason).toBe('spam');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .send({
          targetType: 'Post',
          targetId: targetPostId,
          reason: 'spam',
        });

      expect(res.statusCode).toBe(401);
    });

    it('should fail with invalid reason', async () => {
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetType: 'Post',
          targetId: targetPostId,
          reason: 'invalid_reason_xyz',  // not in enum
        });

      // Mongoose validation will reject this
      expect(res.statusCode).toBe(400);
    });

    it('should create a report for a user', async () => {
      const targetUserId = new mongoose.Types.ObjectId().toString();
      const res = await request(app)
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          targetType: 'User',       // PascalCase
          targetId: targetUserId,
          reason: 'harassment',
          description: 'Sending unwanted messages',
        });

      expect(res.statusCode).toBe(201);
    });
  });
});
