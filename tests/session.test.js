const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');

let authToken;

describe('Session Management Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'session@test.com',
        password: 'Password123!',
        username: 'sessionuser',
        displayName: 'Session User',
      });

    authToken = res.body.token;
  });

  describe('GET /api/v1/auth/sessions', () => {
    it('should return list of active sessions', async () => {
      const res = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.sessions).toBeInstanceOf(Array);
    });

    it('should fail without auth', async () => {
      const res = await request(app).get('/api/v1/auth/sessions');
      expect(res.statusCode).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('should logout from all devices', async () => {
      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('should invalidate the token after logout-all', async () => {
      await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${authToken}`);

      // Token should no longer work
      const res = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(401);
    });
  });
});
