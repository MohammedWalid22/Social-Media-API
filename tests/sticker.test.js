const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Sticker = require('../src/models/Sticker');


jest.mock('../src/config/cloudinary', () => ({
  cloudinary: {
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn().mockResolvedValue(true)
    },
    url: jest.fn().mockReturnValue('mocked_thumbnail_url')
  }
}));

describe('Stickers API Endpoints', () => {
  let adminToken;
  let userToken;
  let adminId;
  let userId;
  let testStickerId;

  beforeEach(async () => {
    await User.deleteMany({});
    await Sticker.deleteMany({});

    // Create Admin
    const adminRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'admin@stickers.com',
        username: 'stickeradmin',
        password: 'Password123!',
      });
    adminToken = adminRes.body.token;
    adminId = adminRes.body.data.user._id;

    // Manually make admin
    await User.findByIdAndUpdate(adminId, { role: 'admin' });

    // Create Normal User
    const userRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'user@stickers.com',
        username: 'stickeruser',
        password: 'Password123!',
      });
    userToken = userRes.body.token;
    userId = userRes.body.data.user._id;

    // Create a base sticker to test with
    const sticker = await Sticker.create({
      name: 'Test Sticker',
      category: 'reactions',
      pack: 'default',
      imageUrl: 'http://example.com/sticker.png',
      publicId: 'test_public_id',
      thumbnailUrl: 'http://example.com/thumb.png',
      createdBy: adminId
    });
    testStickerId = sticker._id.toString();
  });

  describe('GET /api/v1/stickers', () => {
    it('should get all active stickers', async () => {
      const res = await request(app)
        .get('/api/v1/stickers');
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.stickers).toHaveLength(1);
      expect(res.body.data.stickers[0].name).toBe('Test Sticker');
    });

    it('should show collected status if authenticated', async () => {
      await User.findByIdAndUpdate(userId, { stickerCollection: [testStickerId] });

      const res = await request(app)
        .get('/api/v1/stickers')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.stickers[0].isCollected).toBe(true);
    });
  });

  describe('GET /api/v1/stickers/:stickerId', () => {
    it('should get single sticker by id', async () => {
      const res = await request(app)
        .get(`/api/v1/stickers/${testStickerId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.sticker.name).toBe('Test Sticker');
    });

    it('should return 404 for missing sticker', async () => {
      const fakeId = '5f8d0d55b54764421b7156c0';
      const res = await request(app)
        .get(`/api/v1/stickers/${fakeId}`);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('GET /api/v1/stickers/categories', () => {
    it('should return distinct categories', async () => {
      const res = await request(app).get('/api/v1/stickers/categories');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.categories).toContain('reactions');
    });
  });

  describe('POST /api/v1/stickers', () => {
    it('should return 400 if no image file is provided', async () => {
      const res = await request(app)
        .post('/api/v1/stickers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New sticker' });
      expect(res.statusCode).toBe(400); // Because form-data parsing failed or file missing
    });

    // File upload mocking with actual file via supertest is sometimes tricky, focusing on others
  });

  describe('DELETE /api/v1/stickers/:stickerId', () => {
    it('should soft delete sticker as admin', async () => {
      const res = await request(app)
        .delete(`/api/v1/stickers/${testStickerId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      
      expect(res.statusCode).toBe(204);

      const deleted = await Sticker.findById(testStickerId);
      expect(deleted.isActive).toBe(false);
    });

    it('should forbid delete for normal users', async () => {
      const res = await request(app)
        .delete(`/api/v1/stickers/${testStickerId}`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(403);
    });
  });

  describe('PATCH /api/v1/stickers/:stickerId/moderate', () => {
    it('should moderate sticker as admin', async () => {
      const res = await request(app)
        .patch(`/api/v1/stickers/${testStickerId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isOffensive: true, reason: 'Inappropriate' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.sticker.isOffensive).toBe(true);
    });
  });

  describe('POST /api/v1/stickers/:stickerId/collect', () => {
    it('should toggle collect status for a sticker', async () => {
      // Add
      const res1 = await request(app)
        .post(`/api/v1/stickers/${testStickerId}/collect`)
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res1.statusCode).toBe(200);
      expect(res1.body.data.isCollected).toBe(true);
      
      // Remove
      const res2 = await request(app)
        .post(`/api/v1/stickers/${testStickerId}/collect`)
        .set('Authorization', `Bearer ${userToken}`);
        
      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.isCollected).toBe(false);
    });
  });

  describe('GET /api/v1/stickers/me/collection', () => {
    it('should return my sticker collection', async () => {
      await User.findByIdAndUpdate(userId, { stickerCollection: [testStickerId] });

      const res = await request(app)
        .get('/api/v1/stickers/me/collection')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.data.stickers).toHaveLength(1);
    });
  });
});
