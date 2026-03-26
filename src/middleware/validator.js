const { body, param, query, validationResult } = require('express-validator');

// Centralized error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// Common validators
const validators = {
  // Auth validators
  signup: [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    body('username')
      .isLength({ min: 3, max: 30 })
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username can only contain letters, numbers and underscores')
      .toLowerCase(),
    body('displayName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .escape(),
    handleValidationErrors,
  ],
  
  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
    handleValidationErrors,
  ],

  forgotPassword: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    handleValidationErrors,
  ],

  resetPassword: [
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('Password must contain uppercase, lowercase, number and special character'),
    handleValidationErrors,
  ],

  updatePassword: [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
      .withMessage('New password must contain uppercase, lowercase, number and special character'),
    handleValidationErrors,
  ],

  // Post validators
  createPost: [
    body('content')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Content too long (max 5000 characters)')
      .escape(),
    body('visibility')
      .optional()
      .isIn(['public', 'friends', 'followers', 'private', 'custom'])
      .withMessage('Invalid visibility option'),
    body('hashtags')
      .optional()
      .isArray({ max: 30 })
      .withMessage('Maximum 30 hashtags allowed'),
    body('mentions')
      .optional()
      .isArray({ max: 50 })
      .withMessage('Maximum 50 mentions allowed'),
    handleValidationErrors,
  ],

  // Comment validators
  createComment: [
    body('content')
      .optional()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Comment must be between 1 and 2000 characters')
      .escape(),
    body('parentCommentId')
      .optional()
      .isMongoId()
      .withMessage('Invalid parent comment ID'),
    handleValidationErrors,
  ],

  // Message validators
  sendMessage: [
    body('recipientId').isMongoId().withMessage('Invalid recipient ID'),
    body('content').notEmpty().trim().isLength({ max: 5000 }).withMessage('Message too long'),
    body('selfDestruct')
      .optional()
      .isInt({ min: 1, max: 86400 })
      .withMessage('Self-destruct must be between 1 second and 24 hours'),
    handleValidationErrors,
  ],

  // User validators
  updateProfile: [
    body('displayName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Display name must be between 2 and 50 characters')
      .escape(),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio too long (max 500 characters)')
      .escape(),
    body('privacySettings')
      .optional()
      .isObject()
      .withMessage('Privacy settings must be an object'),
    handleValidationErrors,
  ],

  // Query validators
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),
    handleValidationErrors,
  ],

  feedFilter: [
    query('cursor').optional(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .toInt(),
    query('filter')
      .optional()
      .isIn(['all', 'following', 'trending', 'nearby']),
    handleValidationErrors,
  ],

  // Param validators
  objectId: (paramName) => [
    param(paramName).isMongoId().withMessage(`Invalid ${paramName} format`),
    handleValidationErrors,
  ],
};

module.exports = validators;