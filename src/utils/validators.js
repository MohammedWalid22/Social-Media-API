const { body, param, validationResult } = require('express-validator');

// Centralized validation error handler
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

const validators = {
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
  
  post: [
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
    handleValidationErrors,
  ],
  
  comment: [
    body('content')
      .optional()
      .trim()
      .isLength({ min: 1, max: 2000 })
      .escape(),
    body('parentCommentId')
      .optional()
      .isMongoId()
      .withMessage('Invalid parent comment ID'),
    handleValidationErrors,
  ],
  
  // Object ID validator for URL params
  objectId: (field) => [
    param(field)
      .isMongoId()
      .withMessage(`Invalid ${field} format`),
    handleValidationErrors,
  ],
  
  // Reusable handler
  handleValidationErrors,
};

module.exports = validators;