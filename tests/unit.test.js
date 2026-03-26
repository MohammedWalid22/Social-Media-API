const { generateToken, hashToken } = require('../src/utils/crypto');
const { 
  generateId, 
  sanitize, 
  formatNumber, 
  timeAgo, 
  paginate,
  deepClone,
  hashForLog,
  isValidEmail,
  slugify 
} = require('../src/utils/helpers');

describe('Unit Tests - Utils', () => {
  describe('Crypto Utils', () => {
    it('should generate random token of correct length', () => {
      const token = generateToken();
      expect(token).toHaveLength(64); // 32 bytes = 64 hex chars
      
      const shortToken = generateToken(16);
      expect(shortToken).toHaveLength(32);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should hash token consistently', () => {
      const token = 'test-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Helper Utils', () => {
    describe('generateId', () => {
      it('should generate ID of specified length', () => {
        const id = generateId(8);
        expect(id).toHaveLength(16); // 8 bytes = 16 hex chars
      });

      it('should generate unique IDs', () => {
        const id1 = generateId();
        const id2 = generateId();
        expect(id1).not.toBe(id2);
      });
    });

    describe('sanitize', () => {
      it('should escape HTML tags', () => {
        const input = '<script>alert("xss")</script>';
        const result = sanitize(input);
        expect(result).not.toContain('<script>');
        expect(result).toContain('&lt;');
      });

      it('should handle empty string', () => {
        expect(sanitize('')).toBe('');
      });

      it('should handle non-string input', () => {
        expect(sanitize(null)).toBe('');
        expect(sanitize(123)).toBe('');
      });
    });

    describe('formatNumber', () => {
      it('should format thousands as K', () => {
        expect(formatNumber(1500)).toBe('1.5K');
        expect(formatNumber(1000)).toBe('1.0K');
      });

      it('should format millions as M', () => {
        expect(formatNumber(1500000)).toBe('1.5M');
        expect(formatNumber(1000000)).toBe('1.0M');
      });

      it('should return small numbers as-is', () => {
        expect(formatNumber(500)).toBe('500');
        expect(formatNumber(0)).toBe('0');
      });

      it('should handle invalid input', () => {
        expect(formatNumber('invalid')).toBe('0');
        expect(formatNumber(null)).toBe('0');
      });
    });

    describe('timeAgo', () => {
      it('should return "Just now" for recent time', () => {
        const result = timeAgo(new Date());
        expect(result).toBe('Just now');
      });

      it('should return minutes ago', () => {
        const date = new Date(Date.now() - 5 * 60 * 1000);
        expect(timeAgo(date)).toBe('5 minutes ago');
      });

      it('should return hours ago', () => {
        const date = new Date(Date.now() - 2 * 60 * 60 * 1000);
        expect(timeAgo(date)).toBe('2 hours ago');
      });

      it('should handle future dates', () => {
        const future = new Date(Date.now() + 1000);
        expect(timeAgo(future)).toBe('Just now');
      });

      it('should handle string dates', () => {
        const result = timeAgo(new Date().toISOString());
        expect(result).toBe('Just now');
      });
    });

    describe('paginate', () => {
      it('should paginate array correctly', () => {
        const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        expect(paginate(arr, 1, 3)).toEqual([1, 2, 3]);
        expect(paginate(arr, 2, 3)).toEqual([4, 5, 6]);
      });

      it('should handle empty array', () => {
        expect(paginate([], 1, 10)).toEqual([]);
      });

      it('should handle invalid page', () => {
        const arr = [1, 2, 3];
        expect(paginate(arr, -1, 10)).toEqual([1, 2, 3]);
      });

      it('should handle non-array input', () => {
        expect(paginate(null, 1, 10)).toEqual([]);
        expect(paginate('string', 1, 10)).toEqual([]);
      });
    });

    describe('deepClone', () => {
      it('should clone object deeply', () => {
        const obj = { a: 1, b: { c: 2 } };
        const clone = deepClone(obj);
        expect(clone).toEqual(obj);
        expect(clone).not.toBe(obj);
        expect(clone.b).not.toBe(obj.b);
      });

      it('should handle arrays', () => {
        const arr = [1, [2, 3], { a: 4 }];
        const clone = deepClone(arr);
        expect(clone).toEqual(arr);
        expect(clone[1]).not.toBe(arr[1]);
      });

      it('should handle primitives', () => {
        expect(deepClone(5)).toBe(5);
        expect(deepClone('test')).toBe('test');
        expect(deepClone(null)).toBe(null);
      });
    });

    describe('hashForLog', () => {
      it('should hash string consistently', () => {
        const str = 'sensitive-data';
        const hash1 = hashForLog(str);
        const hash2 = hashForLog(str);
        expect(hash1).toBe(hash2);
        expect(hash1).toHaveLength(8);
      });

      it('should handle non-string input', () => {
        expect(hashForLog(12345)).toHaveLength(8);
        expect(hashForLog(null)).toHaveLength(8);
      });
    });

    describe('isValidEmail', () => {
      it('should validate correct emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('@example.com')).toBe(false);
        expect(isValidEmail('test@')).toBe(false);
        expect(isValidEmail('')).toBe(false);
      });
    });

    describe('slugify', () => {
      it('should create URL-friendly slug', () => {
        expect(slugify('Hello World')).toBe('hello-world');
        expect(slugify('Test Title Here')).toBe('test-title-here');
      });

      it('should handle special characters', () => {
        expect(slugify('Hello! World?')).toBe('hello-world');
        expect(slugify('Test@#$%^&*()')).toBe('test');
      });

      it('should handle multiple spaces', () => {
        expect(slugify('Hello    World')).toBe('hello-world');
      });

      it('should lowercase', () => {
        expect(slugify('UPPERCASE')).toBe('uppercase');
      });
    });
  });
});