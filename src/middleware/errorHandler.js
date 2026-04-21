const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// --- Mongoose & JWT Error Converters ---

/** CastError: e.g. invalid ObjectId in URL param */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/** ValidationError: Mongoose schema validation failed */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/** Duplicate key: e.g. email/username already exists (code 11000) */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `The ${field} "${value}" is already taken. Please use a different value.`;
  return new AppError(message, 409);
};

/** Invalid JWT signature */
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401);

/** Expired JWT */
const handleJWTExpiredError = () =>
  new AppError('Your session has expired. Please log in again.', 401);

// --- Response Helpers ---

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  } else {
    // Unknown / programming error — don't leak details
    logger.error('UNEXPECTED ERROR:', err);
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
    });
  }
};

// --- Global Error Handler Middleware ---

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test';

  if (isDev) {
    sendErrorDev(err, res);
  } else {
    // Convert known operational errors from libraries into AppError instances
    let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);

    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

module.exports = { AppError, errorHandler };