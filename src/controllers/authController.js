const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const EmailService = require('../services/emailService');
const AuditLog = require('../models/AuditLog');
const logger = require('../utils/logger');

class AuthController {
  constructor() {
    this.cookieOptions = {
      expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    };
  }

  signToken = (id, deviceId) => {
    return jwt.sign(
      { id, deviceId, iat: Date.now() },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
        algorithm: 'HS256',
      }
    );
  };

  createSendToken = async (user, statusCode, req, res) => {
    const deviceId = crypto.randomBytes(16).toString('hex');
    const token = this.signToken(user._id, deviceId);

    await require('../models/Session').create({
      user: user._id,
      deviceInfo: req.headers['user-agent'] || 'Unknown Device',
      ip: req.ip,
      token,
      isValid: true
    });

    user.password = undefined;

    res.cookie('jwt', token, this.cookieOptions);

    res.status(statusCode).json({
      status: 'success',
      token,
      deviceId,
      data: { user },
    });
  };

  signup = async (req, res, next) => {
    try {
      const { email, password, username, displayName } = req.body;

      const existingUser = await User.findOne({
        $or: [{ email }, { username: username.toLowerCase() }],
      });

      if (existingUser) {
        return res.status(400).json({
          status: 'fail',
          message: 'Email or username already exists',
        });
      }

      const newUser = await User.create({
        email,
        password,
        username: username.toLowerCase(),
        displayName,
        dataConsent: {
          given: true,
          date: new Date(),
          version: '1.0',
        },
      });

      await AuditLog.create({
        user: newUser._id,
        action: 'USER_SIGNUP',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await this.createSendToken(newUser, 201, req, res);
    } catch (error) {
      next(error);
    }
  }

  login = async (req, res, next) => {
    try {
      const { email, password, twoFactorCode } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          status: 'fail',
          message: 'Please provide email and password',
        });
      }

      const user = await User.findOne({ email }).select('+password +twoFactorSecret +loginAttempts +lockUntil');

      if (!user || !(await user.comparePassword(password))) {
        if (user) {
          user.loginAttempts += 1;
          if (user.loginAttempts >= 5) {
            user.lockUntil = Date.now() + 2 * 60 * 60 * 1000;
          }
          await user.save({ validateBeforeSave: false });
        }

        return res.status(401).json({
          status: 'fail',
          message: 'Incorrect email or password',
        });
      }

      if (user.lockUntil && user.lockUntil > Date.now()) {
        return res.status(423).json({
          status: 'fail',
          message: 'Account is locked. Please try again later.',
        });
      }

      if (user.twoFactorEnabled) {
        if (!twoFactorCode) {
          return res.status(401).json({
            status: 'fail',
            message: '2FA code required',
            requires2FA: true,
          });
        }

        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token: twoFactorCode,
          window: 1,
        });

        if (!verified) {
          return res.status(401).json({
            status: 'fail',
            message: 'Invalid 2FA code',
          });
        }
      }

      user.loginAttempts = 0;
      user.lockUntil = undefined;
      user.lastActive = Date.now();
      user.isOnline = true;
      await user.save({ validateBeforeSave: false });

      await AuditLog.create({
        user: user._id,
        action: 'USER_LOGIN',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });

      await this.createSendToken(user, 200, req, res);
    } catch (error) {
      next(error);
    }
  };

  setup2FA = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id);

      const secret = speakeasy.generateSecret({
        name: `SocialApp:${user.email}`,
      });

      user.twoFactorSecret = secret.base32;
      await user.save({ validateBeforeSave: false });

      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

      res.status(200).json({
        status: 'success',
        data: {
          qrCode: qrCodeUrl,
          secret: secret.base32,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  verify2FA = async (req, res, next) => {
    try {
      const { token } = req.body;
      const user = await User.findById(req.user._id).select('+twoFactorSecret');

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token,
        window: 1,
      });

      if (!verified) {
        return res.status(400).json({
          status: 'fail',
          message: 'Invalid verification code',
        });
      }

      user.twoFactorEnabled = true;
      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        status: 'success',
        message: '2FA enabled successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });

      if (!user) {
        return res.status(404).json({
          status: 'fail',
          message: 'No user found with that email',
        });
      }

      const resetToken = user.createPasswordResetToken();
      await user.save({ validateBeforeSave: false });

      const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

      try {
        await EmailService.sendPasswordReset(user.email, resetURL);

        res.status(200).json({
          status: 'success',
          message: 'Password reset link sent to email',
        });
      } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return res.status(500).json({
          status: 'error',
          message: 'Error sending email. Try again later.',
        });
      }
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req, res, next) => {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex');

      const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          status: 'fail',
          message: 'Token is invalid or expired',
        });
      }

      user.password = req.body.password;
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      user.passwordChangedAt = Date.now();
      await user.save();

      await AuditLog.create({
        user: user._id,
        action: 'PASSWORD_RESET',
        ip: req.ip,
      });

      await this.createSendToken(user, 200, req, res);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req, res, next) => {
    try {
      await User.findByIdAndUpdate(req.user._id, {
        isOnline: false,
        lastActive: new Date(),
      });

      let token;
      if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
      }

      if (token) {
        await require('../models/Session').findOneAndUpdate({ token }, { isValid: false });
      }

      res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
      });

      res.status(200).json({ status: 'success' });
    } catch (error) {
      next(error);
    }
  };

  getSessions = async (req, res, next) => {
    try {
      const Session = require('../models/Session');
      const sessions = await Session.find({ user: req.user._id, isValid: true })
        .select('-token')
        .sort('-lastActive');
      res.status(200).json({ status: 'success', data: { sessions } });
    } catch (error) {
      next(error);
    }
  };

  logoutAll = async (req, res, next) => {
    try {
      const Session = require('../models/Session');
      await Session.updateMany({ user: req.user._id, isValid: true }, { isValid: false });
      
      res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
      });

      res.status(200).json({ status: 'success', message: 'Logged out of all accounts' });
    } catch (error) {
      next(error);
    }
  };

  updatePassword = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id).select('+password');

      if (!(await user.comparePassword(req.body.currentPassword))) {
        return res.status(401).json({
          status: 'fail',
          message: 'Current password is incorrect',
        });
      }

      user.password = req.body.newPassword;
      await user.save();

      await AuditLog.create({
        user: user._id,
        action: 'PASSWORD_UPDATE',
        ip: req.ip,
      });

      await this.createSendToken(user, 200, req, res);
    } catch (error) {
      next(error);
    }
  };

  disable2FA = async (req, res, next) => {
    try {
      const { password } = req.body;
      const user = await User.findById(req.user._id).select('+password');

      if (!(await user.comparePassword(password))) {
        return res.status(401).json({
          status: 'fail',
          message: 'Incorrect password',
        });
      }

      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        status: 'success',
        message: '2FA disabled successfully',
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req, res, next) => {
    try {
      const user = req.user;
      const deviceId = req.deviceId || crypto.randomBytes(16).toString('hex');
      const token = this.signToken(user._id, deviceId);

      res.status(200).json({
        status: 'success',
        token,
        deviceId,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req, res, next) => {
    try {
      const { token } = req.params;
      
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      
      const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpires: { $gt: Date.now() },
      });

      if (!user) {
        return res.status(400).json({
          status: 'fail',
          message: 'Token is invalid or has expired',
        });
      }

      user.isEmailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        status: 'success',
        message: 'Email verified successfully',
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new AuthController();