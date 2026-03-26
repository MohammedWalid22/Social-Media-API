const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const Group = require('../src/models/Group');

let authToken;
let authToken2;
let groupId;

describe('Groups Endpoints', () => {
  beforeEach(async () => {
    await User.deleteMany({});
    await Group.deleteMany({});

    // Signup user 1
    const res1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'groupowner@test.com',
        password: 'Password123!',
        username: 'groupowner',
        displayName: 'Group Owner',
      });
    authToken = res1.body.token;

    // Signup user 2
    const res2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        email: 'groupmember@test.com',
        password: 'Password123!',
        username: 'groupmember',
        displayName: 'Group Member',
      });
    authToken2 = res2.body.token;
  });

  describe('POST /api/v1/groups', () => {
    it('should create a public group', async () => {
      const res = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Tech Enthusiasts',
          description: 'A group for tech lovers',
          visibility: 'public',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.group.name).toBe('Tech Enthusiasts');
      groupId = res.body.data.group._id;
    });

    it('should fail without auth', async () => {
      const res = await request(app)
        .post('/api/v1/groups')
        .send({ name: 'No Auth Group' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/v1/groups', () => {
    it('should list all public groups', async () => {
      // Create a group first
      await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Visible Group', visibility: 'public' });

      const res = await request(app)
        .get('/api/v1/groups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.groups).toBeInstanceOf(Array);
      expect(res.body.data.groups.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/v1/groups/:id/join', () => {
    beforeEach(async () => {
      const createRes = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Joinable Group', visibility: 'public' });

      groupId = createRes.body.data.group._id;
    });

    it('should allow another user to join the group', async () => {
      const res = await request(app)
        .post(`/api/v1/groups/${groupId}/join`)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
    });

    it('should not join a private group directly', async () => {
      const createPrivate = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Private Group', visibility: 'private' });

      const privateGroupId = createPrivate.body.data.group._id;

      const res = await request(app)
        .post(`/api/v1/groups/${privateGroupId}/join`)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe('POST /api/v1/groups/:id/leave', () => {
    it('should allow a member to leave a group', async () => {
      const createRes = await request(app)
        .post('/api/v1/groups')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Leave Test Group', visibility: 'public' });

      const gId = createRes.body.data.group._id;

      await request(app)
        .post(`/api/v1/groups/${gId}/join`)
        .set('Authorization', `Bearer ${authToken2}`);

      const res = await request(app)
        .post(`/api/v1/groups/${gId}/leave`)
        .set('Authorization', `Bearer ${authToken2}`);

      expect(res.statusCode).toBe(200);
    });
  });
});
