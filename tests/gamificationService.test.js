const mongoose = require('mongoose');
const gamificationService = require('../src/services/gamificationService');
const User = require('../src/models/User');
const logger = require('../src/utils/logger');

jest.mock('../src/models/User');
jest.mock('../src/utils/logger', () => ({
  error: jest.fn(),
}));

describe('GamificationService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addPoints', () => {
    it('should silently return if user not found', async () => {
      User.findById.mockResolvedValue(null);
      const res = await gamificationService.addPoints('someId', 10);
      expect(res).toBeUndefined();
    });

    it('should initialize gamification if missing and add points', async () => {
      const mockUser = {
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);

      const res = await gamificationService.addPoints('someId', 50);

      expect(mockUser.gamification).toEqual({ points: 50, badges: [] });
      expect(mockUser.save).toHaveBeenCalledWith({ validateBeforeSave: false });
      expect(res).toBe(false); // No badge added
    });

    it('should add active_member badge if reached 100 points', async () => {
      const mockUser = {
        gamification: { points: 90, badges: [] },
        save: jest.fn().mockResolvedValue(true)
      };
      User.findById.mockResolvedValue(mockUser);

      const res = await gamificationService.addPoints('someId', 20);

      expect(mockUser.gamification.points).toBe(110);
      expect(mockUser.gamification.badges).toContain('active_member');
      expect(res).toBe(true);
    });

    it('should add popular_writer badge if reached 1000 points', async () => {
        const mockUser = {
          gamification: { points: 990, badges: ['active_member', 'top_commenter'] },
          save: jest.fn().mockResolvedValue(true)
        };
        User.findById.mockResolvedValue(mockUser);
  
        const res = await gamificationService.addPoints('someId', 15);
  
        expect(mockUser.gamification.badges).toContain('popular_writer');
        expect(res).toBe(true);
    });

    it('should silently ignore DocumentNotFoundError', async () => {
      User.findById.mockRejectedValue({ name: 'DocumentNotFoundError' });
      const res = await gamificationService.addPoints('someId', 10);
      expect(logger.error).not.toHaveBeenCalled();
      expect(res).toBeUndefined();
    });

    it('should log other errors', async () => {
      User.findById.mockRejectedValue(new Error('Random DB Error'));
      const res = await gamificationService.addPoints('someId', 10);
      expect(logger.error).toHaveBeenCalled();
      expect(res).toBeUndefined();
    });
  });
});
