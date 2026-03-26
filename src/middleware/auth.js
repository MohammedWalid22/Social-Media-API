const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');
const logger = require('../utils/logger');
const { AppError } = require('./errorHandler');

class AuthMiddleware {
  // JWT with advanced security
  async protect(req, res, next) {
    try {
      let token;
      
      // 1) Get token from header or cookies
      if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies?.jwt) {
        token = req.cookies.jwt;
      }

      if (!token) {
        return next(new AppError('You are not logged in. Please log in to get access.', 401));
      }

      // Set device ID from header if available
      req.deviceId = req.headers['x-device-id'] || req.body?.deviceId || 'unknown';

      // 2) Verify token with strict options
      const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: process.env.JWT_ISSUER,
        audience: process.env.JWT_AUDIENCE,
      });

      // 2.5) Check if session exists and is valid
      const Session = require('../models/Session');
      const session = await Session.findOne({ token, isValid: true });
      if (!session) {
        return next(new AppError('Session expired or invalid. Please log in again.', 401));
      }

      // 3) Check if user still exists
      const currentUser = await User.findById(decoded.id);
      if (!currentUser || currentUser.accountDeleted) {
        return next(new AppError('The user belonging to this token no longer exists.', 401));
      }

      // 4) Check if user changed password after token was issued
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError('User recently changed password. Please log in again.', 401));
      }

      // 5) Check if account is locked
      if (currentUser.lockUntil && currentUser.lockUntil > Date.now()) {
        return next(new AppError('Account is temporarily locked. Please try again later.', 423));
      }

      // 6) Verify device fingerprint
      if (decoded.deviceId && decoded.deviceId !== req.deviceId) {
        if (process.env.NODE_ENV !== 'test') {
          logger.warn(`Suspicious activity detected for user ${currentUser._id}`, {
            expectedDevice: decoded.deviceId,
            actualDevice: req.deviceId,
            ip: req.ip,
          });
        }
        // Optionally require additional verification but don't block
      }

      // Grant access
      req.user = currentUser;
      req.tokenIssuedAt = decoded.iat;
      next();
      
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return next(new AppError('Your session has expired. Please log in again.', 401));
      }
      if (error.name === 'JsonWebTokenError') {
        return next(new AppError('Invalid token. Please log in again.', 401));
      }
      next(error);
    }
  }

  // Role-based access control
  restrictTo(...roles) {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      next();
    };
  }

  // Optional authentication (for public content with personalization)
  async optionalAuth(req, res, next) {
    try {
      let token = req.headers.authorization?.split(' ')[1] || req.cookies?.jwt;
      
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET, {
          algorithms: ['HS256'],
        });
        
        const user = await User.findById(decoded.id).select('_id username role');
        if (user) {
          req.user = user;
          req.deviceId = req.headers['x-device-id'] || 'unknown';
        }
      }
      
      next();
    } catch (error) {
      // Continue without user if token invalid
      next();
    }
  }
}

module.exports = new AuthMiddleware();