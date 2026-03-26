const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');

describe('Feed Endpoints', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});

    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'feedtest@test.com',
        password: 'Password123!',
        username: 'feedtest',
      });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    // Create some posts
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: `Post ${i}`,
          visibility: 'public',
        });
    }
  });

  describe('GET /api/v1/feed/newsfeed', () => {
    it('should get newsfeed', async () => {
      const res = await request(app)
        .get('/api/v1/feed/newsfeed')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.posts.length).toBeGreaterThan(0);
    });

    it('should support cursor pagination', async () => {
      const res1 = await request(app)
        .get('/api/v1/feed/newsfeed?limit=2')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res1.body.data.nextCursor).toBeDefined();
      
      const res2 = await request(app)
        .get(`/api/v1/feed/newsfeed?limit=2&cursor=${res1.body.data.nextCursor}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.posts.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/feed/trending', () => {
    it('should get trending posts', async () => {
      const res = await request(app)
        .get('/api/v1/feed/trending')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.trending).toBeDefined();
    });

    it('should filter by timeframe', async () => {
      const res = await request(app)
        .get('/api/v1/feed/trending?timeframe=24h')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /api/v1/feed/nearby', () => {
    beforeEach(async () => {
      // Create post with location
      await Post.create({
        author: userId,
        content: { text: 'Nearby post' },
        visibility: 'public',
        location: {
          type: 'Point',
          coordinates: [-73.9857, 40.7484], // NYC
        },
      });
    });

    it('should get nearby posts', async () => {
      const res = await request(app)
        .get('/api/v1/feed/nearby?longitude=-73.9857&latitude=40.7484&radius=5000')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.posts.length).toBeGreaterThan(0);
    });

    it('should fail without coordinates', async () => {
      const res = await request(app)
        .get('/api/v1/feed/nearby')
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(400);
    });
  });
});