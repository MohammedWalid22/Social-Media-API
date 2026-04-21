const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const AuthController = require('../src/controllers/authController');
const User = require('../src/models/User');
const Session = require('../src/models/Session');
const AuditLog = require('../src/models/AuditLog');
const EmailService = require('../src/services/emailService');

jest.mock('jsonwebtoken');
jest.mock('speakeasy');
jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('mock_qr_code')
}));
jest.mock('../src/models/User');
jest.mock('../src/models/Session');
jest.mock('../src/models/AuditLog');
jest.mock('../src/services/emailService');

describe('AuthController Unit Tests', () => {
  let authController;
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    authController = AuthController;

    mockReq = {
      body: {},
      headers: { 'user-agent': 'jest-test' },
      ip: '127.0.0.1',
      cookies: {},
      user: { _id: 'user_1' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      cookie: jest.fn()
    };

    mockNext = jest.fn();

    jwt.sign.mockReturnValue('mock_token');
    Session.create.mockResolvedValue(true);
    AuditLog.create.mockResolvedValue(true);
  });

  describe('signup', () => {
    it('should return 400 if user exists', async () => {
      mockReq.body = { email: 'test@example.com', username: 'testuser', password: 'password' };
      User.findOne.mockResolvedValue({ _id: 'existing_user' });

      await authController.signup(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 409 }));
    });

    it('should create user and send token', async () => {
      mockReq.body = { email: 'new@example.com', username: 'newuser', password: 'password' };
      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue({ _id: 'new_user', email: 'new@example.com' });

      await authController.signup(mockReq, mockRes, mockNext);

      expect(User.create).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        token: 'mock_token'
      }));
    });
  });

  describe('login', () => {
    it('should return 400 if missing email or password', async () => {
      mockReq.body = { email: 'test@example.com' };
      await authController.login(mockReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('should return 401 if user not found or bad password', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong' };
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(false),
        loginAttempts: 0,
        save: jest.fn().mockResolvedValue(true)
      };
      // For findOne().select()
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockUser.loginAttempts).toBe(1);
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should lock account on 5th bad attempt', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong' };
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(false),
        loginAttempts: 4,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockUser.loginAttempts).toBe(5);
      expect(mockUser.lockUntil).toBeDefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 423 if locked', async () => {
      mockReq.body = { email: 'test@example.com', password: 'wrong' };
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(true),
        lockUntil: Date.now() + 10000 // In future
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 423 }));
    });

    it('should require 2FA code if enabled', async () => {
      mockReq.body = { email: 'test@example.com', password: 'right' };
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(true),
        twoFactorEnabled: true
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        requires2FA: true
      }));
    });

    it('should login successfully and reset attempts', async () => {
      mockReq.body = { email: 'test@example.com', password: 'right' };
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(true),
        loginAttempts: 2,
        save: jest.fn().mockResolvedValue(true)
      };
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });

      await authController.login(mockReq, mockRes, mockNext);

      expect(mockUser.loginAttempts).toBe(0);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        token: 'mock_token'
      }));
    });
  });

  describe('setup2FA', () => {
    it('should generate speakeasy secret and qr code', async () => {
      const mockUser = { email: 'test@test.com', save: jest.fn() };
      User.findById.mockResolvedValue(mockUser);
      speakeasy.generateSecret.mockReturnValue({ base32: 'secret32', otpauth_url: 'url' });

      await authController.setup2FA(mockReq, mockRes, mockNext);

      expect(mockUser.twoFactorSecret).toBe('secret32');
      expect(mockUser.save).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ qrCode: 'mock_qr_code' })
      }));
    });
  });

  describe('verify2FA', () => {
    it('should enable 2FA if token verifies', async () => {
      mockReq.body = { token: '123456' };
      const mockUser = { twoFactorSecret: 'secret', save: jest.fn().mockResolvedValue(true) };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      speakeasy.totp.verify.mockReturnValue(true);

      await authController.verify2FA(mockReq, mockRes, mockNext);

      expect(speakeasy.totp.verify).toHaveBeenCalled();
      expect(mockUser.twoFactorEnabled).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if token invalid', async () => {
      mockReq.body = { token: '000000' };
      const mockUser = { twoFactorSecret: 'secret' };
      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser)
      });
      speakeasy.totp.verify.mockReturnValue(false);

      await authController.verify2FA(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });
  });
  
  describe('forgotPassword', () => {
    it('should send reset email', async () => {
      mockReq.body = { email: 'test@example.com' };
      const mockUser = { 
        email: 'test@example.com', 
        displayName: 'Test', 
        save: jest.fn(),
        createPasswordResetToken: jest.fn().mockReturnValue('token')
      };
      User.findOne.mockResolvedValue(mockUser);

      await authController.forgotPassword(mockReq, mockRes, mockNext);
      
      expect(mockUser.save).toHaveBeenCalled();
      expect(EmailService.sendPasswordReset).toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 if user not found', async () => {
      mockReq.body = { email: 'test@example.com' };
      User.findOne.mockResolvedValue(null);

      await authController.forgotPassword(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
    });
  });
  
  describe('logout', () => {
    it('should invalidate session and clear cookies', async () => {
      mockReq.headers.authorization = 'Bearer mock_token';
      
      await authController.logout(mockReq, mockRes, mockNext);

      expect(Session.findOneAndUpdate).toHaveBeenCalledWith(
        { token: 'mock_token' },
        { isValid: false }
      );
      expect(mockRes.cookie).toHaveBeenCalledWith('jwt', 'loggedout', expect.any(Object));
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
