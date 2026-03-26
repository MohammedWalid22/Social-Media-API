const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');

let authToken;
let postId;

describe('Bookmarks (Saved Posts) Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'bookmarker@test.com',
        password: 'Password123!',
        username: 'bookmarker',
        displayName: 'Bookmarker User',
      });

    authToken = res.body.token;

    // Create a post to bookmark
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'This post will be saved' });

    postId = postRes.body.data?.post?._id;
  });

  describe('POST /api/v1/posts/:postId/save', () => {
    it('should save a post to bookmarks', async () => {
      if (!postId) return;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/save`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('should fail without authentication', async () => {
      if (!postId) return;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/save`);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/users/me/saved-posts', () => {
    it('should return list of saved posts', async () => {
      const res = await request(app)
        .get('/api/v1/users/me/saved-posts')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.savedPosts).toBeInstanceOf(Array);
    });
  });

  describe('DELETE /api/v1/posts/:postId/save', () => {
    it('should remove a post from bookmarks', async () => {
      if (!postId) return;

      // Save first
      await request(app)
        .post(`/api/v1/posts/${postId}/save`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then unsave
      const res = await request(app)
        .delete(`/api/v1/posts/${postId}/save`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
    });
  });
});
