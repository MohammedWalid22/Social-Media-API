const helpers = require('../src/utils/helpers');

describe('helpers utility', () => {
  // ─── generateId ───────────────────────────────────────────────────────────
  describe('generateId()', () => {
    it('should generate a hex string of default length 32 chars (16 bytes)', () => {
      const id = helpers.generateId();
      expect(typeof id).toBe('string');
      expect(id).toHaveLength(32);
    });

    it('should generate ID of custom byte length', () => {
      const id = helpers.generateId(8);
      expect(id).toHaveLength(16);
    });

    it('should generate unique IDs each time', () => {
      const id1 = helpers.generateId();
      const id2 = helpers.generateId();
      expect(id1).not.toBe(id2);
    });
  });

  // ─── sanitize ─────────────────────────────────────────────────────────────
  describe('sanitize()', () => {
    it('should return empty string for non-string input', () => {
      expect(helpers.sanitize(123)).toBe('');
      expect(helpers.sanitize(null)).toBe('');
      expect(helpers.sanitize(undefined)).toBe('');
    });

    it('should sanitize HTML special characters', () => {
      const result = helpers.sanitize('<script>alert("xss")</script>');
      expect(result).not.toContain('<script>');
    });

    it('should return clean string unchanged when no special chars', () => {
      const result = helpers.sanitize('Hello World');
      expect(result).toContain('Hello');
      expect(result).toContain('World');
    });
  });

  // ─── formatNumber ─────────────────────────────────────────────────────────
  describe('formatNumber()', () => {
    it('should return "0" for non-numbers', () => {
      expect(helpers.formatNumber('abc')).toBe('0');
      expect(helpers.formatNumber(null)).toBe('0');
    });

    it('should format millions', () => {
      expect(helpers.formatNumber(1500000)).toBe('1.5M');
    });

    it('should format thousands', () => {
      expect(helpers.formatNumber(2300)).toBe('2.3K');
    });

    it('should return plain number for small values', () => {
      expect(helpers.formatNumber(42)).toBe('42');
    });

    it('should handle exactly 1000', () => {
      expect(helpers.formatNumber(1000)).toBe('1.0K');
    });
  });

  // ─── timeAgo ──────────────────────────────────────────────────────────────
  describe('timeAgo()', () => {
    it('should return "Just now" for recent dates (< 60s)', () => {
      const now = new Date();
      expect(helpers.timeAgo(now)).toBe('Just now');
    });

    it('should return "X minutes ago" for minutes in the past', () => {
      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
      expect(helpers.timeAgo(threeMinutesAgo)).toBe('3 minutes ago');
    });

    it('should return "1 minute ago" (singular)', () => {
      const oneMinuteAgo = new Date(Date.now() - 61 * 1000);
      expect(helpers.timeAgo(oneMinuteAgo)).toBe('1 minute ago');
    });

    it('should return "X hours ago"', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
      expect(helpers.timeAgo(twoHoursAgo)).toBe('2 hours ago');
    });

    it('should return "X days ago"', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
      expect(helpers.timeAgo(threeDaysAgo)).toBe('3 days ago');
    });

    it('should handle future dates as "Just now"', () => {
      const future = new Date(Date.now() + 10000);
      expect(helpers.timeAgo(future)).toBe('Just now');
    });

    it('should handle invalid date string', () => {
      expect(helpers.timeAgo('not-a-date')).toBe('Invalid date');
    });

    it('should accept string date input', () => {
      const dateStr = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      const result = helpers.timeAgo(dateStr);
      expect(result).toContain('hour');
    });
  });

  // ─── paginate ─────────────────────────────────────────────────────────────
  describe('paginate()', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    it('should return empty array for non-array input', () => {
      expect(helpers.paginate('not an array', 1, 5)).toEqual([]);
    });

    it('should return first page', () => {
      expect(helpers.paginate(arr, 1, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return second page', () => {
      expect(helpers.paginate(arr, 2, 5)).toEqual([6, 7, 8, 9, 10]);
    });

    it('should return empty array when page is beyond data', () => {
      expect(helpers.paginate(arr, 5, 5)).toEqual([]);
    });

    it('should default page to 1 if < 1', () => {
      expect(helpers.paginate(arr, 0, 3)).toEqual([1, 2, 3]);
    });

    it('should default limit to 10 if < 1', () => {
      const result = helpers.paginate(arr, 1, 0);
      expect(result).toHaveLength(10);
    });
  });

  // ─── deepClone ────────────────────────────────────────────────────────────
  describe('deepClone()', () => {
    it('should return primitive values as-is', () => {
      expect(helpers.deepClone(42)).toBe(42);
      expect(helpers.deepClone(null)).toBe(null);
      expect(helpers.deepClone('string')).toBe('string');
    });

    it('should deep clone an object', () => {
      const original = { a: 1, nested: { b: 2 } };
      const clone = helpers.deepClone(original);
      expect(clone).toEqual(original);
      clone.nested.b = 99;
      expect(original.nested.b).toBe(2); // no mutation
    });

    it('should deep clone an array', () => {
      const arr = [1, { x: 2 }, 3];
      const clone = helpers.deepClone(arr);
      expect(clone).toEqual(arr);
      clone[1].x = 99;
      expect(arr[1].x).toBe(2);
    });
  });

  // ─── hashForLog ───────────────────────────────────────────────────────────
  describe('hashForLog()', () => {
    it('should return 8-char hex string', () => {
      const hash = helpers.hashForLog('sensitive-data');
      expect(hash).toHaveLength(8);
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should convert non-string input to string', () => {
      expect(() => helpers.hashForLog(123)).not.toThrow();
      expect(helpers.hashForLog(123)).toHaveLength(8);
    });
  });

  // ─── isValidEmail ─────────────────────────────────────────────────────────
  describe('isValidEmail()', () => {
    it('should return true for valid emails', () => {
      expect(helpers.isValidEmail('test@example.com')).toBe(true);
      expect(helpers.isValidEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(helpers.isValidEmail('notanemail')).toBe(false);
      expect(helpers.isValidEmail('@no-user.com')).toBe(false);
      expect(helpers.isValidEmail('no-at-sign')).toBe(false);
    });
  });

  // ─── slugify ──────────────────────────────────────────────────────────────
  describe('slugify()', () => {
    it('should convert string to slug', () => {
      expect(helpers.slugify('Hello World!')).toBe('hello-world');
    });

    it('should handle multiple spaces and special chars', () => {
      expect(helpers.slugify('  My  Cool  Post  ')).toBe('my-cool-post');
    });

    it('should remove leading/trailing dashes', () => {
      const result = helpers.slugify('---test---');
      expect(result).not.toMatch(/^-|-$/);
    });
  });
});
