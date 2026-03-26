const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

describe('User Endpoints', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});

    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'usertest@test.com',
        password: 'Password123!',
        username: 'usertest',
        displayName: 'User Test',
      });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;
  });

  describe('GET /api/v1/users/me', () => {
    it('should get current user profile', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.email).toBe('usertest@test.com');
      expect(res.body.data.user.username).toBe('usertest');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .get('/api/v1/users/me');
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update user profile', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Updated Name',
          bio: 'My bio',
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.displayName).toBe('Updated Name');
      expect(res.body.data.user.bio).toBe('My bio');
    });
  });

  describe('POST /api/v1/users/:userId/follow', () => {
    let otherUserId;

    beforeEach(async () => {
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'Password123!',
        username: 'otheruser',
      });
      otherUserId = otherUser._id;
    });

    it('should follow another user', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${otherUserId}/follow`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.following).toBe(true);
    });

    it('should not allow following self', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${userId}/follow`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/users/search', () => {
    it('should search users', async () => {
      const res = await request(app)
        .get('/api/v1/users/search?q=user')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.users.length).toBeGreaterThan(0);
    });

    it('should fail with short query', async () => {
      const res = await request(app)
        .get('/api/v1/users/search?q=a')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(400);
    });
  });
});