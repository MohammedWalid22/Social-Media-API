const crypto = require('crypto');

// Use he library if available, otherwise basic escape
let he;
try {
  he = require('he');
} catch {
  he = null;
}

const helpers = {
  // Generate secure random ID
  generateId: (length = 16) => {
    return crypto.randomBytes(length).toString('hex');
  },

  // Sanitize user input (XSS protection)
  sanitize: (str) => {
    if (typeof str !== 'string') return '';
    
    if (he) {
      return he.encode(str, { useNamedReferences: true });
    }
    
    // Fallback basic sanitization
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Format numbers (1.2K, 1.5M)
  formatNumber: (num) => {
    if (typeof num !== 'number') return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  },

  // Time ago formatter
  timeAgo: (date) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const seconds = Math.floor((new Date() - date) / 1000);
    
    // Handle future dates
    if (seconds < 0) return 'Just now';
    
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit);
      if (interval >= 1) {
        return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  },

  // Paginate array
  paginate: (array, page, limit) => {
    if (!Array.isArray(array)) return [];
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    
    const start = (page - 1) * limit;
    if (start >= array.length) return [];
    
    return array.slice(start, start + limit);
  },

  // Deep clone object
  deepClone: (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    
    // Use structuredClone if available (Node 17+)
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(obj);
      } catch (e) {
        // Fall through to JSON method
      }
    }
    
    // Fallback with warning for circular references
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      console.error('Deep clone failed:', e);
      return obj;
    }
  },

  // Hash sensitive data for logs
  hashForLog: (data) => {
    if (typeof data !== 'string') data = String(data);
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 8);
  },

  // Validate email format
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Slugify string
  slugify: (str) => {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },
};

module.exports = helpers;