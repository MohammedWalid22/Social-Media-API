const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');

describe('Comment Endpoints', () => {
  let token;
  let postId;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});

    // Create user
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'commenttest@test.com',
        password: 'Password123!',
        username: 'commenttest',
      });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    // Create post
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Post for comments' });
    
    postId = postRes.body.data.post._id;
  });

  describe('POST /api/v1/posts/:postId/comments', () => {
    it('should create text comment', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Test comment',
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.comment.content).toBe('Test comment');
      expect(res.body.data.comment.contentType).toBe('text');
    });

    it('should create nested reply', async () => {
      // Create parent comment
      const parentRes = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Parent comment' });

      const parentId = parentRes.body.data.comment._id;

      // Create reply
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          content: 'Reply comment',
          parentCommentId: parentId,
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.comment.parentComment).toBe(parentId);
    });
  });

  describe('GET /api/v1/posts/:postId/comments', () => {
    beforeEach(async () => {
      // Add some comments
      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Comment 1' });

      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Comment 2' });
    });

    it('should get comments with pagination', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.results).toBeGreaterThanOrEqual(2);
      expect(res.body.data.comments.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}/comments?type=text`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.comments.every(c => c.contentType === 'text')).toBe(true);
    });
  });

  describe('POST /api/v1/comments/:commentId/like', () => {
    let commentId;

    beforeEach(async () => {
      const commentRes = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Comment to like' });
      
      commentId = commentRes.body.data.comment._id;
    });

    it('should like a comment', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/${commentId}/like`)
        .set('Authorization', `Bearer ${token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.likesCount).toBe(1);
    });
  });
});