const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const xss = require('xss-clean');
const rateLimit = require('express-rate-limit');

class SecurityMiddleware {
  constructor() {
    this.helmetConfig = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
          mediaSrc: ["'self'", 'https:', 'blob:'],
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

    this.corsConfig = cors({
      origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001',
        ];
        
        // Allow requests with no origin (mobile apps, curl, etc.)
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
      ],
      exposedHeaders: ['X-Total-Count', 'X-Rate-Limit-Remaining'],
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204,
    });

    this.mongoSanitizeConfig = mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        console.warn(`⚠️  Sanitized key: ${key} from IP: ${req.ip} at ${new Date().toISOString()}`);
      },
    });

    this.hppConfig = hpp({
      whitelist: [
        'sort',
        'fields',
        'page',
        'limit',
        'status',
        'type',
        'category',
        'tags',
      ],
    });

    this.xssConfig = xss();
  }

  // Additional security headers middleware
  additionalHeaders(req, res, next) {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Disable caching for sensitive routes
    if (req.path.includes('/auth') || req.path.includes('/admin')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    
    // Add request ID for tracking
    res.setHeader('X-Request-ID', req.id || require('crypto').randomUUID());
    
    next();
  }

  // IP-based rate limiting for sensitive endpoints
  strictRateLimit() {
    return rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      message: {
        status: 'fail',
        message: 'Too many requests from this IP, please try again later.',
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.ip,
      handler: (req, res, next, options) => {
        res.status(options.statusCode).json(options.message);
      },
      onLimitReached: (req, res, options) => {
        console.warn(`🚫 Rate limit exceeded for IP: ${req.ip} at ${new Date().toISOString()}`);
      },
    });
  }

  // API rate limiting
  apiRateLimit() {
    return rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 100,
      message: {
        status: 'fail',
        message: 'Too many requests, please slow down.',
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
  }

  // Apply all security middleware
  applyAll(app) {
    app.use(this.helmetConfig);
    app.use(this.corsConfig);
    app.use(this.mongoSanitizeConfig);
    app.use(this.hppConfig);
    app.use(this.xssConfig);
    app.use(this.additionalHeaders);
    
    console.log('🔒 Security middleware applied');
  }
}

module.exports = new SecurityMiddleware();