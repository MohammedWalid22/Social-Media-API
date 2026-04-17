/* eslint-disable no-console */
const dotenv = require('dotenv');
dotenv.config({ path: './.env' });
const app = require('./src/app');
const database = require('./src/config/database');
const NotificationSocketService = require('./src/services/notificationSocketService');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Connect to database before starting server
const startServer = async () => {
  try {
    await database.connect();
    
    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT} in ${NODE_ENV} mode`);
      console.log(`📡 API URL: http://localhost:${PORT}/api/v1`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
    });

    // Initialize Real-time notification socket server
    new NotificationSocketService(server);

    process.on('unhandledRejection', (err) => {
      console.error('❌ UNHANDLED REJECTION! Shutting down...');
      console.error(err.name, err.message);
      const Sentry = require('@sentry/node');
      Sentry.captureException(err);
      server.close(() => process.exit(1));
    });

    process.on('uncaughtException', (err) => {
      console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
      console.error(err.name, err.message);
      const Sentry = require('@sentry/node');
      Sentry.captureException(err);
      process.exit(1);
    });

    // Handle port already in use
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      }
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();