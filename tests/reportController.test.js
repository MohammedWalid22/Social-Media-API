const Report = require('../src/models/Report');

jest.mock('../src/models/Report');

const reportController = require('../src/controllers/reportController');

describe('ReportController Unit Tests', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { _id: 'user_1', role: 'user' },
      body: {},
      params: {},
      query: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
  });

  // ─── createReport ─────────────────────────────────────────────────────────
  describe('createReport', () => {
    it('should create a report for a Post', async () => {
      mockReq.body = { targetType: 'Post', targetId: 'post_1', reason: 'spam', description: 'spammy' };
      Report.create.mockResolvedValue({ _id: 'report_1', ...mockReq.body });

      await reportController.createReport(mockReq, mockRes);

      expect(Report.create).toHaveBeenCalledWith(expect.objectContaining({
        reporter: 'user_1',
        targetType: 'Post',
        reportedPost: 'post_1'
      }));
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });

    it('should create a report for a User', async () => {
      mockReq.body = { targetType: 'User', targetId: 'user_2', reason: 'harassment' };
      Report.create.mockResolvedValue({ _id: 'report_2', ...mockReq.body });

      await reportController.createReport(mockReq, mockRes);

      expect(Report.create).toHaveBeenCalledWith(expect.objectContaining({ reportedUser: 'user_2' }));
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should create a report for a Comment', async () => {
      mockReq.body = { targetType: 'Comment', targetId: 'comment_1', reason: 'hate_speech' };
      Report.create.mockResolvedValue({ _id: 'report_3' });

      await reportController.createReport(mockReq, mockRes);

      expect(Report.create).toHaveBeenCalledWith(expect.objectContaining({ reportedComment: 'comment_1' }));
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 400 on error', async () => {
      Report.create.mockRejectedValue(new Error('Validation error'));
      await reportController.createReport(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  // ─── getReports ───────────────────────────────────────────────────────────
  describe('getReports', () => {
    it('should return 403 for non-admin/moderator users', async () => {
      mockReq.user.role = 'user';
      await reportController.getReports(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return all reports for admin', async () => {
      mockReq.user.role = 'admin';
      const mockReports = [{ _id: 'r1' }, { _id: 'r2' }];
      Report.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockReports)
      });

      await reportController.getReports(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        results: 2
      }));
    });

    it('should filter reports by status query param', async () => {
      mockReq.user.role = 'moderator';
      mockReq.query.status = 'pending';
      const mockReports = [{ _id: 'r1', status: 'pending' }];
      Report.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(mockReports)
      });

      await reportController.getReports(mockReq, mockRes);

      expect(Report.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 on DB error', async () => {
      mockReq.user.role = 'admin';
      Report.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockRejectedValue(new Error('DB error'))
      });
      await reportController.getReports(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── updateReportStatus ───────────────────────────────────────────────────
  describe('updateReportStatus', () => {
    it('should return 403 for non-admin/moderator', async () => {
      mockReq.user.role = 'user';
      await reportController.updateReportStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 if report not found', async () => {
      mockReq.user.role = 'admin';
      mockReq.params.id = 'nonexistent_id';
      mockReq.body = { status: 'resolved' };
      Report.findByIdAndUpdate.mockResolvedValue(null);

      await reportController.updateReportStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should update status and set resolvedAt when resolved', async () => {
      mockReq.user.role = 'admin';
      mockReq.params.id = 'report_1';
      mockReq.body = { status: 'resolved', resolutionNotes: 'Removed content' };
      const updatedReport = { _id: 'report_1', status: 'resolved' };
      Report.findByIdAndUpdate.mockResolvedValue(updatedReport);

      await reportController.updateReportStatus(mockReq, mockRes);

      expect(Report.findByIdAndUpdate).toHaveBeenCalledWith(
        'report_1',
        expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(Number) }),
        { new: true, runValidators: true }
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should update status without resolvedAt for non-terminal status', async () => {
      mockReq.user.role = 'moderator';
      mockReq.params.id = 'report_1';
      mockReq.body = { status: 'reviewing' };
      Report.findByIdAndUpdate.mockResolvedValue({ _id: 'report_1', status: 'reviewing' });

      await reportController.updateReportStatus(mockReq, mockRes);

      const updateArg = Report.findByIdAndUpdate.mock.calls[0][1];
      expect(updateArg.resolvedAt).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 on validation error', async () => {
      mockReq.user.role = 'admin';
      mockReq.body = { status: 'resolved' };
      Report.findByIdAndUpdate.mockRejectedValue(new Error('Validation fail'));
      await reportController.updateReportStatus(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});
