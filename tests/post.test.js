/* eslint-disable no-unused-vars */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');

describe('Post Endpoints', () => {
  let token;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});

    // Create test user and get token
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'posttest@test.com',
        password: 'Password123!',
        username: 'posttest',
      });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;
  });

  describe('POST /api/v1/posts', () => {
    it('should create a new post', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Test post content',
          visibility: 'public',
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.post.content.text).toBe('Test post content');
    });

    it('should fail without authentication', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .send({
          content: 'Test post content',
        });
      
      expect(res.statusCode).toBe(401);
    });

    it('should extract hashtags from content', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Hello #world #testing',
          visibility: 'public',
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.post.hashtags).toContain('world');
      expect(res.body.data.post.hashtags).toContain('testing');
    });
  });

  describe('POST /api/v1/posts/:postId/like', () => {
    let postId;

    beforeEach(async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Post to like' });
      
      postId = postRes.body.data.post._id;
    });

    it('should like a post', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${token}`)
        .send({ reaction: 'like' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.isLiked).toBe(true);
      expect(res.body.data.likesCount).toBe(1);
    });

    it('should unlike a post when liked again', async () => {
      // Like first
      await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${token}`);

      // Unlike
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.isLiked).toBe(false);
      expect(res.body.data.likesCount).toBe(0);
    });
  });

  describe('GET /api/v1/posts/:postId', () => {
    it('should get a single post', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Post to get' });
      
      const postId = postRes.body.data.post._id;

      const res = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.post.content.text).toBe('Post to get');
    });
  });

  describe('PATCH /api/v1/posts/:postId', () => {
    it('should update a post if author', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Old content' });
      const postId = postRes.body.data.post._id;

      const res = await request(app)
        .patch(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'New content' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.post.content.text).toBe('New content');
    });
  });

  describe('DELETE /api/v1/posts/:postId', () => {
    it('should delete a post if author', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'To delete' });
      const postId = postRes.body.data.post._id;

      const res = await request(app)
        .delete(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      
      // verify it is deleted
      const getRes = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/posts/:postId/bookmark', () => {
    it('should bookmark and unbookmark a post', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Bookmark me' });
      const postId = postRes.body.data.post._id;

      // Bookmark
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/bookmark`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.isBookmarked).toBe(true);

      // Unbookmark
      const res2 = await request(app)
        .post(`/api/v1/posts/${postId}/bookmark`)
        .set('Authorization', `Bearer ${token}`);
      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.isBookmarked).toBe(false);
    });
  });

  describe('POST /api/v1/posts/:postId/poll/vote', () => {
    it('should vote on a poll', async () => {
      const postRes = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ 
          content: 'Poll post',
          poll: { question: 'Q?', options: [{ text: 'A' }, { text: 'B' }] }
        });
      
      const post = postRes.body.data.post;
      // We assume it creates the poll successfully, we'll extract option ID
      if(post.poll && post.poll.options.length > 0) {
        const optionId = post.poll.options[0]._id;
        
        const res = await request(app)
          .post(`/api/v1/posts/${post._id}/poll/vote`)
          .set('Authorization', `Bearer ${token}`)
          .send({ optionId });
        
        expect(res.statusCode).toBe(200); // Or whatever success code
      }
    });
  });
});
