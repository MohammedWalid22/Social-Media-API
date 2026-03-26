const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');

describe('Auth Endpoints', () => {
  let testUser;
  
  beforeEach(async () => {
    // Clean up
    await User.deleteMany({});
  });

  describe('POST /api/v1/auth/signup', () => {
    it('should signup a new user successfully', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'test@test.com',
          password: 'Password123!',
          username: 'testuser',
          displayName: 'Test User',
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe('test@test.com');
      expect(res.body.token).toBeDefined();
      
      // Verify user was created in DB
      const user = await User.findOne({ email: 'test@test.com' });
      expect(user).toBeTruthy();
      expect(user.username).toBe('testuser');
    });

    it('should fail with weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'test2@test.com',
          password: 'weak',
          username: 'testuser2',
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should fail with duplicate email', async () => {
      // Create user first
      await User.create({
        email: 'duplicate@test.com',
        password: 'Password123!',
        username: 'duplicate',
      });

      // Try to create again
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'duplicate@test.com',
          password: 'Password123!',
          username: 'duplicate2',
        });
      
      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      testUser = await User.create({
        email: 'login@test.com',
        password: 'Password123!',
        username: 'logintest',
      });
    });

    it('should login existing user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@test.com',
          password: 'Password123!',
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.data.user.email).toBe('login@test.com');
    });

    it('should fail with wrong password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'login@test.com',
          password: 'WrongPassword123!',
        });
      
      expect(res.statusCode).toBe(401);
    });

    it('should fail with non-existent user', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!',
        });
      
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout user', async () => {
      // Login first
      await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'logout@test.com',
          password: 'Password123!',
          username: 'logouttest',
        });

      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logout@test.com',
          password: 'Password123!',
        });

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${loginRes.body.token}`);
      
      expect(res.statusCode).toBe(200);
    });
  });
});