const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Post = require('../src/models/Post');
const AudioComment = require('../src/models/AudioComment');
const path = require('path');
const fs = require('fs');

describe('Audio Features', () => {
  let token;
  let postId;
  let userId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
    await AudioComment.deleteMany({});

    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'audiotest@test.com',
        password: 'Password123!',
        username: 'audiotest',
      });

    token = signupRes.body.token;
    userId = signupRes.body.data.user._id;

    const postRes = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Post for audio comments' });

    postId = postRes.body.data.post._id;
  });

  describe('POST /api/v1/posts/:postId/comments/audio', () => {
    it('should upload audio comment', async () => {
      // Create a dummy audio file
      const dummyAudioPath = path.join(__dirname, 'test-audio.mp3');
      fs.writeFileSync(dummyAudioPath, Buffer.from('fake audio data'));

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/audio`)
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', dummyAudioPath)
        .field('textAccompaniment', 'Audio comment text');

      // Cleanup
      fs.unlinkSync(dummyAudioPath);

      expect(res.statusCode).toBe(201);
      expect(res.body.data.comment.contentType).toBe('mixed');
      expect(res.body.data.comment.audioComment).toBeDefined();
    });

    it('should fail without audio file', async () => {
      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/audio`)
        .set('Authorization', `Bearer ${token}`)
        .send({ textAccompaniment: 'No audio' });

      expect(res.statusCode).toBe(400);
    });

    it('should fail with invalid file type', async () => {
      const dummyFilePath = path.join(__dirname, 'test.txt');
      fs.writeFileSync(dummyFilePath, 'not an audio file');

      const res = await request(app)
        .post(`/api/v1/posts/${postId}/comments/audio`)
        .set('Authorization', `Bearer ${token}`)
        .attach('audio', dummyFilePath);

      fs.unlinkSync(dummyFilePath);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/v1/comments/audio/:audioCommentId/transcription', () => {
    let audioCommentId;

    beforeEach(async () => {
      // Create audio comment directly in DB for testing
      const audioComment = await AudioComment.create({
        comment: new mongoose.Types.ObjectId(),
        audio: {
          url: 'https://example.com/audio.mp3',
          publicId: 'test-audio',
          duration: 30,
        },
        transcription: {
          text: 'Test transcription',
          language: 'en',
          confidence: 0.95,
          processed: true,
          processedAt: new Date(),
        },
      });
      audioCommentId = audioComment._id;
    });

    it('should get transcription', async () => {
      const res = await request(app)
        .get(`/api/v1/comments/audio/${audioCommentId}/transcription`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.text).toBe('Test transcription');
    });

    it('should return pending if not processed', async () => {
      await AudioComment.findByIdAndUpdate(audioCommentId, {
        'transcription.processed': false,
      });

      const res = await request(app)
        .get(`/api/v1/comments/audio/${audioCommentId}/transcription`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(202);
      expect(res.body.status).toBe('pending');
    });
  });

  describe('POST /api/v1/comments/audio/:audioCommentId/play', () => {
    let audioCommentId;

    beforeEach(async () => {
      const audioComment = await AudioComment.create({
        comment: new mongoose.Types.ObjectId(),
        audio: {
          url: 'https://example.com/audio.mp3',
          publicId: 'test-audio',
          duration: 30,
        },
        plays: [],
        playsCount: 0,
      });
      audioCommentId = audioComment._id;
    });

    it('should record audio play', async () => {
      const res = await request(app)
        .post(`/api/v1/comments/audio/${audioCommentId}/play`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.playsCount).toBe(1);
    });

    it('should increment play count for same user', async () => {
      // First play
      await request(app)
        .post(`/api/v1/comments/audio/${audioCommentId}/play`)
        .set('Authorization', `Bearer ${token}`);

      // Second play
      const res = await request(app)
        .post(`/api/v1/comments/audio/${audioCommentId}/play`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.userPlays).toBe(2);
    });
  });

  describe('PATCH /api/v1/comments/audio/:audioCommentId/speed', () => {
    let audioCommentId;

    beforeEach(async () => {
      const audioComment = await AudioComment.create({
        comment: new mongoose.Types.ObjectId(),
        audio: {
          url: 'https://example.com/audio.mp3',
          publicId: 'test-audio',
        },
        defaultSpeed: 1.0,
      });
      audioCommentId = audioComment._id;
    });

    it('should update playback speed', async () => {
      const res = await request(app)
        .patch(`/api/v1/comments/audio/${audioCommentId}/speed`)
        .set('Authorization', `Bearer ${token}`)
        .send({ speed: 1.5 });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.speed).toBe(1.5);
    });

    it('should reject invalid speed', async () => {
      const res = await request(app)
        .patch(`/api/v1/comments/audio/${audioCommentId}/speed`)
        .set('Authorization', `Bearer ${token}`)
        .send({ speed: 3.0 });

      expect(res.statusCode).toBe(400);
    });
  });
});