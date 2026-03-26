// Central export for all middleware
module.exports = {
  auth: require('./auth'),
  cache: require('./cache'),
  errorHandler: require('./errorHandler'),
  logger: require('./logger'),
  rateLimiter: require('./rateLimiter'),
  security: require('./security'),
  socketAuth: require('./socketAuth'),
  upload: require('./upload'),
  validators: require('./validator'),
};