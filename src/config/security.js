const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss-clean');

class SecurityConfig {
  constructor() {
    this.helmet = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:', '*.cloudinary.com'],
          mediaSrc: ["'self'", 'https:', 'blob:', '*.cloudinary.com'],
          connectSrc: ["'self'", 'https://api.yourdomain.com', 'wss://realtime.yourdomain.com'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      originAgentCluster: true,
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    });

    this.cors = cors({
      origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173', // Vite default
          'http://localhost:8080',
        ];
        
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'X-Device-ID',
        'X-API-Version',
        'X-Request-ID',
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-Rate-Limit-Remaining',
        'X-Rate-Limit-Reset',
      ],
      maxAge: 86400,
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    this.mongoSanitize = mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        console.warn(`⚠️  Sanitized key: ${key} from IP: ${req.ip} at ${new Date().toISOString()}`);
      },
    });

    this.hpp = hpp({
      whitelist: [
        'sort',
        'fields',
        'page',
        'limit',
        'status',
        'type',
        'category',
        'tags',
        'startDate',
        'endDate',
      ],
    });

    this.xss = xss();
  }

  // Additional security headers middleware
  additionalHeaders() {
    return (req, res, next) => {
      // Request ID for tracking
      req.id = require('crypto').randomUUID();
      res.setHeader('X-Request-ID', req.id);

      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Disable caching for sensitive routes
      const sensitiveRoutes = ['/auth', '/admin', '/api/v1/auth', '/api/v1/admin'];
      if (sensitiveRoutes.some(route => req.path.startsWith(route))) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }

      // Permissions policy
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      next();
    };
  }

  // IP whitelist for admin routes
  ipWhitelist(allowedIPs) {
    return (req, res, next) => {
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!allowedIPs.includes(clientIP)) {
        return res.status(403).json({
          status: 'fail',
          message: 'Access denied from this IP address',
        });
      }
      next();
    };
  }

  // Request size limiter
  sizeLimiter() {
    return require('express').json({
      limit: '10kb',
    });
  }
}

module.exports = new SecurityConfig();