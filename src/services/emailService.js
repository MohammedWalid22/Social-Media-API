const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isEnabled = false;
    this.initialize();
  }

  initialize() {
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
      logger.warn('Email configuration not found. Email service disabled.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        // port 587 uses STARTTLS (secure:false + requireTLS:true)
        // port 465 uses SSL from the start (secure:true)
        secure: parseInt(process.env.EMAIL_PORT) === 465,
        requireTLS: parseInt(process.env.EMAIL_PORT) !== 465, // force STARTTLS on port 587
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,
        socketTimeout: 15000,
        pool: process.env.NODE_ENV === 'production',
        maxConnections: 5,
        maxMessages: 100,
      });


      // In production, verify SMTP connection at startup.
      // In development, skip the verify() to avoid blocking startup
      // on firewall/ISP restrictions — real errors will surface when
      // an email is actually sent.
      if (process.env.NODE_ENV === 'production') {
        this.transporter.verify((error) => {
          if (error) {
            logger.error('Email transporter verification failed:', error);
            this.isEnabled = false;
          } else {
            logger.info('✅ Email service ready');
            this.isEnabled = true;
          }
        });
      } else {
        // Optimistically enable in development
        this.isEnabled = true;
        logger.info('✅ Email service ready (dev mode — SMTP verify skipped)');
      }
    } catch (error) {
      logger.error('Email service initialization failed:', error);
      this.isEnabled = false;
    }
  }

  async sendEmail(options) {
    if (!this.isEnabled || !this.transporter) {
      logger.warn('Email service not configured. Skipping email.');
      return { success: false, error: 'Service not configured' };
    }

    try {
      const result = await this.transporter.sendMail({
        from: `Social App <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
        ...options,
      });
      
      logger.info(`Email sent: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Email send failed:', error);
      return { success: false, error: error.message };
    }
  }

  async sendPasswordReset(email, name, resetURL) {
    return await this.sendEmail({
      to: email,
      subject: 'Password Reset Request',
      html: this.getPasswordResetTemplate(name, resetURL),
      text: `Hi ${name},\n\nClick here to reset your password: ${resetURL}\n\nThis link expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`,
    });
  }

  async sendWelcome(email, name) {
    return await this.sendEmail({
      to: email,
      subject: 'Welcome to Social App!',
      html: this.getWelcomeTemplate(name),
      text: `Hi ${name},\n\nWelcome to Social App! Your account has been created successfully.\n\nStart exploring and connecting with others.`,
    });
  }

  async sendEmailVerification(email, name, verificationURL) {
    return await this.sendEmail({
      to: email,
      subject: 'Verify Your Email',
      html: this.getVerificationTemplate(name, verificationURL),
      text: `Hi ${name},\n\nClick here to verify your email: ${verificationURL}\n\nThis link expires in 24 hours.`,
    });
  }

  async sendSecurityAlert(email, action, ip, location = '', time = new Date()) {
    return await this.sendEmail({
      to: email,
      subject: 'Security Alert - New Activity Detected',
      html: this.getSecurityAlertTemplate(action, ip, location, time),
      text: `Security Alert: ${action} from IP ${ip} at ${time.toLocaleString()}. If this wasn't you, please secure your account.`,
    });
  }

  async sendFollowNotification(email, followerName, followerUsername) {
    return await this.sendEmail({
      to: email,
      subject: `${followerName} started following you`,
      html: this.getFollowNotificationTemplate(followerName, followerUsername),
    });
  }

  async sendMessageNotification(email, senderName, messagePreview) {
    return await this.sendEmail({
      to: email,
      subject: `New message from ${senderName}`,
      html: this.getMessageNotificationTemplate(senderName, messagePreview),
    });
  }

  // Email Templates
  getPasswordResetTemplate(name, resetURL) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { background: #f8f9fa; padding: 30px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>You requested a password reset. Click the button below to reset your password:</p>
            <center><a href="${resetURL}" class="button">Reset Password</a></center>
            <p>Or copy this link: <a href="${resetURL}">${resetURL}</a></p>
            <p><strong>This link expires in 10 minutes.</strong></p>
            <p>If you didn't request this, please ignore this email or contact support if you're concerned.</p>
          </div>
          <div class="footer">
            <p>Social App Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getWelcomeTemplate(name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Welcome to Social App</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #28a745; color: white; padding: 20px; text-align: center; }
          .content { background: #f8f9fa; padding: 30px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome ${name}!</h1>
          </div>
          <div class="content">
            <p>Your account has been created successfully. We're excited to have you on board!</p>
            <center><a href="${process.env.FRONTEND_URL}" class="button">Get Started</a></center>
            <p>Start exploring and connecting with others.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getVerificationTemplate(name, verificationURL) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Verify Your Email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background: #17a2b8; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Verify Your Email</h1>
          <p>Hi ${name},</p>
          <p>Click the button below to verify your email address:</p>
          <center><a href="${verificationURL}" class="button">Verify Email</a></center>
          <p>This link expires in 24 hours.</p>
        </div>
      </body>
      </html>
    `;
  }

  getSecurityAlertTemplate(action, ip, location, time) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Security Alert</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .alert { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .details { background: #f8f9fa; padding: 20px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="alert">
            <h1>🔒 Security Alert</h1>
          </div>
          <div class="details">
            <p><strong>Action:</strong> ${action}</p>
            <p><strong>IP Address:</strong> ${ip}</p>
            ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
            <p><strong>Time:</strong> ${time.toLocaleString()}</p>
          </div>
          <p>If this wasn't you, please secure your account immediately.</p>
        </div>
      </body>
      </html>
    `;
  }

  getFollowNotificationTemplate(followerName, followerUsername) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Follower</h2>
        <p><strong>${followerName}</strong> (@${followerUsername}) started following you!</p>
        <a href="${process.env.FRONTEND_URL}/profile/${followerUsername}" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">View Profile</a>
      </div>
    `;
  }

  getMessageNotificationTemplate(senderName, messagePreview) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>New Message</h2>
        <p><strong>${senderName}</strong> sent you a message:</p>
        <blockquote style="background: #f8f9fa; padding: 15px; border-left: 4px solid #007bff;">
          "${messagePreview}"
        </blockquote>
        <a href="${process.env.FRONTEND_URL}/messages" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px;">View Message</a>
      </div>
    `;
  }
}

module.exports = new EmailService();