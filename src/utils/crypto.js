const crypto = require('crypto');

const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

// Generate cryptographically secure random string
const generateRandomString = (length = 16) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
};

// Generate secure password reset token
const generatePasswordResetToken = () => {
  const resetToken = generateRandomString(32);
  const hashedToken = hashToken(resetToken);
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return {
    resetToken,    // Send to user
    hashedToken,   // Save to DB
    expiresAt,
  };
};

// Generate email verification token
const generateVerificationToken = () => {
  return generateRandomString(64);
};

// Hash sensitive data for comparison
const hashData = (data, salt = '') => {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'fallback-secret')
    .update(data + salt)
    .digest('hex');
};

module.exports = {
  generateToken,
  hashToken,
  generateRandomString,
  generatePasswordResetToken,
  generateVerificationToken,
  hashData,
};