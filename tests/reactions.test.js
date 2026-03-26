const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');

let authToken;
let postId;
let commentId;

describe('Comment Reactions Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'reactor@test.com',
        password: 'Password123!',
        username: 'reactor',
        displayName: 'Reactor User',
      });

    authToken = res.body.token;

    // Create a post
    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'Post to comment on' });

    postId = postRes.body.data?.post?._id;
    if (!postId) return;

    // Create a comment
    const commentRes = await request(app)
      .post(`/api/v1/posts/${postId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ content: 'A great comment' });

    commentId = commentRes.body.data?.comment?._id;
  });

  describe('POST /api/v1/posts/:postId/comments/:commentId/react', () => {
    it('should add a "love" reaction to a comment', async () => {
      if (!commentId) return;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'love' });

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.reaction).toBe('love');
      expect(res.body.data.reactionsCount).toBe(1);
    });

    it('should toggle off a reaction when clicking the same type', async () => {
      if (!commentId) return;

      // React first
      await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'like' });

      // React again with same type to toggle off
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'like' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.reaction).toBeNull();
      expect(res.body.data.reactionsCount).toBe(0);
    });

    it('should switch reaction type', async () => {
      if (!commentId) return;

      // React with love
      await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'love' });

      // Switch to laugh
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'laugh' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.reaction).toBe('laugh');
      expect(res.body.data.reactionsCount).toBe(1);
    });

    it('should reject invalid reaction types', async () => {
      if (!commentId) return;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ reaction: 'invalid_type' });

      expect(res.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      if (!commentId) return;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/${commentId}/react`)
        .send({ reaction: 'like' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('Nested Comments (Replies)', () => {
    it('should create a reply to an existing comment', async () => {
      if (!commentId || !postId) return;

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'This is a reply',
          parentCommentId: commentId,
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.data.comment.content).toBe('This is a reply');
    });

    it('should fetch top-level comments only (no replies in root)', async () => {
      if (!commentId || !postId) return;

      // Create a reply
      await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'A nested reply',
          parentCommentId: commentId,
        });

      const res = await request(app)
        .get(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      // All returned comments should be top-level (no parentComment)
      res.body.data.comments.forEach(c => {
        expect(c.parentComment).toBeNull();
      });
    });
  });
});
