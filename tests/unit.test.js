/* eslint-disable no-unused-vars */
const { generateToken, hashToken, generateRandomString, generatePasswordResetToken, generateVerificationToken, hashData } = require('../src/utils/crypto');
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
const APIFeatures = require('../src/utils/apiFeatures');

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

    describe('generateRandomString', () => {
      it('should generate a string of default length 16', () => {
        expect(generateRandomString()).toHaveLength(16);
      });
      it('should generate a string of specified length', () => {
        expect(generateRandomString(32)).toHaveLength(32);
      });
    });

    describe('generatePasswordResetToken', () => {
      it('should return resetToken, hashedToken, and expiresAt', () => {
        const result = generatePasswordResetToken();
        expect(result).toHaveProperty('resetToken');
        expect(result).toHaveProperty('hashedToken');
        expect(result).toHaveProperty('expiresAt');
        expect(result.resetToken).toHaveLength(32);
        expect(result.expiresAt).toBeGreaterThan(Date.now());
      });
    });

    describe('generateVerificationToken', () => {
      it('should generate a 64 character random string', () => {
        expect(generateVerificationToken()).toHaveLength(64);
      });
    });

    describe('hashData', () => {
      it('should hash data with hmac sha256', () => {
        const hashed1 = hashData('myData', 'salt1');
        const hashed2 = hashData('myData', 'salt1');
        const hashed3 = hashData('myData', 'salt2');
        expect(hashed1).toBe(hashed2);
        expect(hashed1).not.toBe(hashed3);
      });
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

  describe('APIFeatures', () => {
    let queryMock;
    beforeEach(() => {
      queryMock = {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis()
      };
    });

    it('should filter out pagination and sort fields', () => {
      const queryString = { page: '2', sort: 'name', limit: '10', fields: 'name', search: 'test', role: 'admin' };
      const features = new APIFeatures(queryMock, queryString);
      features.filter();
      expect(queryMock.find).toHaveBeenCalledWith({ role: 'admin' });
    });

    it('should handle advanced filtering (gte, gt, etc)', () => {
      const queryString = { price: { gte: '10', lt: '50' } };
      const features = new APIFeatures(queryMock, queryString);
      features.filter();
      expect(queryMock.find).toHaveBeenCalledWith({ price: { $gte: '10', $lt: '50' } });
    });

    it('should sort dynamically and default to -createdAt', () => {
      const featuresWithSort = new APIFeatures(queryMock, { sort: 'price,-name' });
      featuresWithSort.sort();
      expect(queryMock.sort).toHaveBeenCalledWith('price -name');

      const featuresDefault = new APIFeatures(queryMock, {});
      featuresDefault.sort();
      expect(queryMock.sort).toHaveBeenCalledWith('-createdAt');
    });

    it('should limit fields or exclude __v by default', () => {
      const featuresWithFields = new APIFeatures(queryMock, { fields: 'name,email' });
      featuresWithFields.limitFields();
      expect(queryMock.select).toHaveBeenCalledWith('name email');

      const featuresDefault = new APIFeatures(queryMock, {});
      featuresDefault.limitFields();
      expect(queryMock.select).toHaveBeenCalledWith('-__v');
    });

    it('should paginate correctly', () => {
      const features = new APIFeatures(queryMock, { page: '2', limit: '5' });
      features.paginate();
      expect(queryMock.skip).toHaveBeenCalledWith(5);
      expect(queryMock.limit).toHaveBeenCalledWith(5);
      expect(features.pagination).toEqual({ page: 2, limit: 5, skip: 5 });
    });

    it('should implement search on given fields', () => {
      const features = new APIFeatures(queryMock, { search: 'test' });
      features.search(['name', 'description']);
      expect(queryMock.find).toHaveBeenCalledWith({
        $or: [
          { name: /test/i },
          { description: /test/i }
        ]
      });
    });

    it('should return pagination info', async () => {
      const features = new APIFeatures(queryMock, { page: '2', limit: '10' });
      features.paginate();
      const info = await features.getPaginationInfo(25);
      expect(info).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        pages: 3,
        hasNext: true,
        hasPrev: true
      });
    });
  });
});
