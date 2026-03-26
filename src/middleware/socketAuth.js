const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    
    const user = await User.findById(decoded.id)
      .select('_id username displayName avatar isVerified');
    
    if (!user) {
      return next(new Error('Authentication error: User not found'));
    }

    // Store minimal user data on socket
    socket.userId = user._id.toString();
    socket.user = user.toObject();
    
    logger.info(`Socket authenticated: ${user.username} (${socket.id})`);
    next();
  } catch (error) {
    let message = 'Authentication error';
    
    if (error.name === 'TokenExpiredError') {
      message = 'Authentication error: Token expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Authentication error: Invalid token';
    }
    
    logger.warn(`Socket auth failed: ${message}`);
    next(new Error(message));
  }
};

module.exports = socketAuth;