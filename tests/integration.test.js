const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const Comment = require('../src/models/Comment');
const Message = require('../src/models/Message');

describe('Integration Tests - Full User Journey', () => {
  let user1Token, user2Token;
  let user1Id, user2Id;
  let postId, commentId;

  beforeAll(async () => {
    // Clean slate
    await User.deleteMany({});
    await Post.deleteMany({});
    await Comment.deleteMany({});
    await Message.deleteMany({});
  });

  describe('Complete User Flow', () => {
    it('Step 1: User 1 signs up', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'journey1@test.com',
          password: 'Password123!',
          username: 'journeyuser1',
          displayName: 'Journey User 1',
        });
      
      expect(res.statusCode).toBe(201);
      user1Token = res.body.token;
      user1Id = res.body.data.user._id;
    });

    it('Step 2: User 2 signs up', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'journey2@test.com',
          password: 'Password123!',
          username: 'journeyuser2',
          displayName: 'Journey User 2',
        });
      
      expect(res.statusCode).toBe(201);
      user2Token = res.body.token;
      user2Id = res.body.data.user._id;
    });

    it('Step 3: User 1 creates a post', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Hello world! #firstpost #journey',
          visibility: 'public',
        });
      
      expect(res.statusCode).toBe(201);
      postId = res.body.data.post._id;
      expect(res.body.data.post.hashtags).toContain('firstpost');
    });

    it('Step 4: User 2 follows User 1', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${user1Id}/follow`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.following).toBe(true);
    });

    it('Step 5: User 2 likes User 1\'s post', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/like`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ reaction: 'like' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.isLiked).toBe(true);
      expect(res.body.data.likesCount).toBe(1);
    });

    it('Step 6: User 2 comments on User 1\'s post', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          content: 'Great post!',
        });
      
      expect(res.statusCode).toBe(201);
      commentId = res.body.data.comment._id;
      expect(res.body.data.comment.content).toBe('Great post!');
    });

    it('Step 7: User 1 replies to the comment', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          content: 'Thanks for the comment!',
          parentCommentId: commentId,
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.comment.parentComment).toBe(commentId);
    });

    it('Step 8: User 2 sends message to User 1', async () => {
      const res = await request(app)
        .post('/api/v1/messages')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          recipientId: user1Id,
          content: 'Hey, love your posts!',
        });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.data.message.status).toBe('sent');
    });

    it('Step 9: User 1 checks notifications', async () => {
      // Wait a bit for notifications to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      const res = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.notifications.length).toBeGreaterThan(0);
      expect(res.body.data.unreadCount).toBeGreaterThan(0);
    });

    it('Step 10: User 1 views their feed', async () => {
      const res = await request(app)
        .get('/api/v1/feed/newsfeed')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.posts.length).toBeGreaterThan(0);
    });

    it('Step 11: User 1 updates profile', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          bio: 'Living the journey!',
        });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.bio).toBe('Living the journey!');
    });

    it('Step 12: User 2 searches for User 1', async () => {
      const res = await request(app)
        .get('/api/v1/users/search?q=journey')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.users.some(u => u.username === 'journeyuser1')).toBe(true);
    });

    it('Step 13: User 1 views conversation with User 2', async () => {
      const res = await request(app)
        .get(`/api/v1/messages/${user2Id}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.messages.length).toBeGreaterThan(0);
    });

    it('Step 14: User 2 unfollows User 1', async () => {
      const res = await request(app)
        .post(`/api/v1/users/${user1Id}/follow`)
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.following).toBe(false);
    });

    it('Step 15: User 1 deletes their post', async () => {
      const res = await request(app)
        .delete(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(204);
    });

    it('Step 16: Verify post is deleted', async () => {
      const res = await request(app)
        .get(`/api/v1/posts/${postId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid ObjectId gracefully', async () => {
      const res = await request(app)
        .get('/api/v1/posts/invalid-id')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(400);
      expect(res.body.status).toBe('fail');
    });

    it('should handle unauthorized access', async () => {
      const res = await request(app)
        .post('/api/v1/posts')
        .send({ content: 'Unauthorized' });
      
      expect(res.statusCode).toBe(401);
    });

    it('should handle validation errors', async () => {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({
          email: 'invalid-email',
          password: '123',
        });
      
      expect(res.statusCode).toBe(400);
      expect(res.body.errors).toBeDefined();
    });
  });

  describe('Privacy & Security', () => {
    it('should not allow viewing private profile without following', async () => {
      // Set user1 to private
      await User.findByIdAndUpdate(user1Id, {
        'privacySettings.profileVisibility': 'private',
      });

      const res = await request(app)
        .get('/api/v1/users/journeyuser1')
        .set('Authorization', `Bearer ${user2Token}`);
      
      expect(res.statusCode).toBe(403);
    });

    it('should not expose sensitive fields in user object', async () => {
      const res = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${user1Token}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.twoFactorSecret).toBeUndefined();
    });
  });
});