const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'social-media-api' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880,
      maxFiles: 5,
    })
  ]
});

// Custom formatter: converts Error objects and plain objects to readable strings
const readableFormat = winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
  // If message is an Error object
  if (message instanceof Error) {
    return `${level}: ${message.message}${message.stack ? '\n' + message.stack : ''}`;
  }
  // If message is a plain object, serialize it
  if (typeof message === 'object' && message !== null) {
    message = JSON.stringify(message, null, 2);
  }
  // Attach any extra metadata (like error stack passed separately)
  const extras = Object.keys(meta).length
    ? '\n' + JSON.stringify(meta, null, 2)
    : '';
  const stackTrace = stack ? '\n' + stack : '';
  return `${level}: ${message}${stackTrace}${extras}`;
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.errors({ stack: true }),
      readableFormat,
    ),
  }));
}

module.exports = logger;