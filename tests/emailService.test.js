const nodemailer = require('nodemailer');
const emailService = require('../src/services/emailService');
const logger = require('../src/utils/logger');

jest.mock('nodemailer');
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('EmailService Unit Tests', () => {
  let mockSendMail;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-msg-id' });

    nodemailer.createTransport.mockReturnValue({
      sendMail: mockSendMail,
      verify: jest.fn((cb) => cb(null))
    });

    // Re-initialize to apply mocks
    process.env.EMAIL_HOST = 'smtp.test.com';
    process.env.EMAIL_USER = 'test@test.com';
    process.env.EMAIL_PASS = 'password';
    emailService.initialize();
  });

  afterAll(() => {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
  });

  describe('Initialization', () => {
    it('should disable email service if config is missing', () => {
      delete process.env.EMAIL_HOST;
      emailService.initialize();
      expect(emailService.isEnabled).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('not found'));
      process.env.EMAIL_HOST = 'smtp.test.com'; // restore
    });

    it('should initialize and set isEnabled to true', () => {
      emailService.initialize();
      expect(emailService.isEnabled).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should handle verification failures in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      nodemailer.createTransport.mockReturnValue({
        verify: jest.fn((cb) => cb(new Error('SMTP Error')))
      });

      emailService.initialize();
      expect(logger.error).toHaveBeenCalledWith('Email transporter verification failed:', expect.any(Error));
      expect(emailService.isEnabled).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('sendEmail', () => {
    it('should skip sending if service is disabled', async () => {
      emailService.isEnabled = false;
      const result = await emailService.sendEmail({ to: 'user@test.com' });
      expect(result.success).toBe(false);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should send email successfully', async () => {
      const result = await emailService.sendEmail({
        to: 'user@test.com',
        subject: 'Test',
        text: 'Hello'
      });
      expect(mockSendMail).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-msg-id');
      expect(logger.info).toHaveBeenCalledWith('Email sent: test-msg-id');
    });

    it('should return false if sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('Send Error'));
      const result = await emailService.sendEmail({ to: 'user@test.com' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('Send Error');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Template Sends', () => {
    it('should send password reset email', async () => {
      await emailService.sendPasswordReset('user@test.com', 'John', 'http://reset');
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'Password Reset Request',
      }));
    });

    it('should send welcome email', async () => {
      await emailService.sendWelcome('user@test.com', 'John');
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: 'user@test.com',
        subject: 'Welcome to Social App!',
      }));
    });

    it('should send verification email', async () => {
      await emailService.sendEmailVerification('user@test.com', 'John', 'http://verify');
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Verify Your Email',
      }));
    });

    it('should send security alert', async () => {
      await emailService.sendSecurityAlert('user@test.com', 'Login', '127.0.0.1', 'Local', new Date());
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Security Alert - New Activity Detected',
      }));
    });

    it('should send follow notification', async () => {
      await emailService.sendFollowNotification('user@test.com', 'Bob', 'bob123');
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'Bob started following you',
      }));
    });

    it('should send message notification', async () => {
      await emailService.sendMessageNotification('user@test.com', 'Alice', 'Hello there');
      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
        subject: 'New message from Alice',
      }));
    });
  });
});
