const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  req.requestTime = new Date().toISOString();
  req.id = require('crypto').randomUUID();

  // Log request start
  logger.info({
    type: 'request_start',
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user?._id,
    requestId: req.id,
    timestamp: req.requestTime,
  });

  // Capture response time
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info({
      type: 'request_complete',
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      ip: req.ip,
      userId: req.user?._id,
      requestId: req.id,
    });

    // Log slow requests
    if (duration > 1000) {
      logger.warn({
        type: 'slow_request',
        method: req.method,
        url: req.originalUrl,
        duration: `${duration}ms`,
        requestId: req.id,
      });
    }
  });

  next();
};

module.exports = requestLogger;