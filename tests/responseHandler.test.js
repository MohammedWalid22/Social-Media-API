const { success, error, paginatedSuccess } = require('../src/utils/responseHandler');

describe('responseHandler utility', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      req: { id: 'req-123' }
    };
  });

  describe('success()', () => {
    it('should respond 200 with data', () => {
      success(mockRes, { user: 'test' });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'success',
        data: { user: 'test' },
        requestId: 'req-123'
      }));
    });

    it('should use custom statusCode', () => {
      success(mockRes, { item: 'created' }, 201);
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should include meta fields in response', () => {
      success(mockRes, {}, 200, { total: 42 });
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ total: 42 }));
    });

    it('should not include requestId when req.id is absent', () => {
      mockRes.req = undefined;
      success(mockRes, {});
      const response = mockRes.json.mock.calls[0][0];
      expect(response.requestId).toBeUndefined();
    });
  });

  describe('error()', () => {
    it('should respond 400 with error message', () => {
      error(mockRes, 'Something went wrong');
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'fail',
        message: 'Something went wrong'
      }));
    });

    it('should include errors array when provided', () => {
      error(mockRes, 'Validation failed', 422, [{ field: 'email', msg: 'Invalid' }]);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        errors: [{ field: 'email', msg: 'Invalid' }]
      }));
    });

    it('should not include errors when null', () => {
      error(mockRes, 'Not Found', 404, null);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.errors).toBeUndefined();
    });

    it('should include requestId from req.id', () => {
      error(mockRes, 'Unauthorized', 401);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        requestId: 'req-123'
      }));
    });
  });

  describe('paginatedSuccess()', () => {
    it('should return data with pagination metadata', () => {
      const pagination = { page: 2, limit: 10, total: 100 };
      paginatedSuccess(mockRes, [{ id: 1 }], pagination);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        pagination: {
          page: 2,
          limit: 10,
          total: 100,
          pages: 10,
          hasNext: true,
          hasPrev: true
        }
      }));
    });

    it('should report hasPrev=false on first page', () => {
      const pagination = { page: 1, limit: 10, total: 50 };
      paginatedSuccess(mockRes, [], pagination);
      const { pagination: p } = mockRes.json.mock.calls[0][0];
      expect(p.hasPrev).toBe(false);
    });

    it('should report hasNext=false on last page', () => {
      const pagination = { page: 5, limit: 10, total: 50 };
      paginatedSuccess(mockRes, [], pagination);
      const { pagination: p } = mockRes.json.mock.calls[0][0];
      expect(p.hasNext).toBe(false);
    });
  });
});
