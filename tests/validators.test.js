const { validationResult } = require('express-validator');
const validators = require('../src/utils/validators');

jest.mock('express-validator', () => ({
  ...jest.requireActual('express-validator'),
  validationResult: jest.fn()
}));

describe('Unit Tests - Validators', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('handleValidationErrors', () => {
    it('should call next() if there are no errors', () => {
      validationResult.mockReturnValue({
        isEmpty: () => true
      });

      validators.handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 400 with errors array when validation fails', () => {
      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => [
          { path: 'email', msg: 'Invalid email', value: 'bademail' },
          { path: 'password', msg: 'Too short', value: '123' }
        ]
      });

      validators.handleValidationErrors(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Validation failed',
        errors: [
          { field: 'email', message: 'Invalid email', value: 'bademail' },
          { field: 'password', message: 'Too short', value: '123' }
        ]
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('objectId validator', () => {
    it('should return express-validator chains for objectId', () => {
      const middleware = validators.objectId('userId');
      expect(Array.isArray(middleware)).toBe(true);
      expect(middleware).toHaveLength(2); // The param() and the handleValidationErrors
    });
  });
});
