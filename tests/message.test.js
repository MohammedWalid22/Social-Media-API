const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Message = require('../src/models/Message');

describe('Message Endpoints', () => {
  let token1, token2;
  let userId1, userId2;

  beforeEach(async () => {
    await User.deleteMany({});
    await Message.deleteMany({});

    // Create two users
    const signup1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'user1@test.com',
        password: 'Password123!',
        username: 'user1',
      });
    token1 = signup1.body.token;
    userId1 = signup1.body.data.user._id;

    const signup2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'user2@test.com',
        password: 'Password123!',
        username: 'user2',
      });
    token2 = signup2.body.token;
    userId2 = signup2.body.data.user._id;
  });

  describe('POST /api/v1/messages', () => {
    it('should send message', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          recipientId: userId2,
          content: 'Hello from user1',
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.message.status).toBe('sent');
    });

    it('should fail if recipient blocks messages', async () => {
      // Update user2 privacy settings
      await User.findByIdAndUpdate(userId2, {
        'privacySettings.allowMessages': 'none',
      });

      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          recipientId: userId2,
          content: 'Hello',
        });
      
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /api/v1/messages/:userId', () => {
    beforeEach(async () => {
      // Send some messages
      await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          recipientId: userId2,
          content: 'Message 1',
        });

      await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token2}`)
        .send({
          recipientId: userId1,
          content: 'Reply',
        });
    });

    it('should get conversation', async () => {
      const res = await request(app)
        .get(`/api/v1/messages/${userId2}`)
        .set('Authorization', `Bearer ${token1}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
    });

    it('should support cursor pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/messages/${userId2}?limit=1`)
        .set('Authorization', `Bearer ${token1}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.nextCursor).toBeDefined();
    });
  });

  describe('GET /api/v1/messages/conversations', () => {
    it('should get conversations list', async () => {
      // Send message first
      await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          recipientId: userId2,
          content: 'Hello',
        });

      const res = await request(app)
        .get('/api/v1/messages/conversations')
        .set('Authorization', `Bearer ${token1}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.conversations.length).toBeGreaterThan(0);
    });
  });

  describe('PATCH /api/v1/messages/:messageId/read', () => {
    it('should mark message as read', async () => {
      const msgRes = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          recipientId: userId2,
          content: 'Read me',
        });
      
      const messageId = msgRes.body.data.message._id;

      const res = await request(app)
        .patch(`/api/v1/messages/${messageId}/read`)
        .set('Authorization', `Bearer ${token2}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.message.status).toBe('read');
    });
  });
});