const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const redisManager = require('./config/redis');

// Import configurations
const security = require('./middleware/security');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const requestLogger = require('./middleware/logger');
const routes = require('./routes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

// Import Sentry
const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

const app = express();

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Express({ app }),
    nodeProfilingIntegration(),
  ],
  // Performance Monitoring
  tracesSampleRate: 1.0, 
  // Set sampling rate for profiling
  profilesSampleRate: 1.0,
  environment: process.env.NODE_ENV || 'development'
});

// The request handler must be the first middleware on the app
app.use(Sentry.Handlers.requestHandler());
// TracingHandler creates a trace for every incoming request
app.use(Sentry.Handlers.tracingHandler());

// Trust proxy (for nginx/docker)
app.set('trust proxy', 1);

// Apply all security middleware
security.applyAll(app);

// Body parsing with limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Static files (uploads temp)
app.use('/tmp', express.static(path.join(process.cwd(), 'tmp')));

// API Documentation
app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// API Routes
app.use('/api/v1', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const redisStatus = redisManager.isReady() ? 'connected' : 'disconnected';
  const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'OK' : 'ERROR',
    database: dbStatus,
    redis: redisStatus
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Social Media API',
    version: '1.0.0',
    status: 'running',
    documentation: '/api/v1/docs',
    health: '/health',
  });
});

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// Sentry error handler must be before any other error middleware and after all controllers
app.use(Sentry.Handlers.errorHandler());

// Global error handler
app.use(errorHandler);

module.exports = app;