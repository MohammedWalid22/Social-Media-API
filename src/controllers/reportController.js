const Report = require('../models/Report');

exports.createReport = async (req, res) => {
  try {
    const { targetType, targetId, reason, description } = req.body;
    
    // Construct report object dynamically
    const reportData = {
      reporter: req.user._id,
      targetType,
      targetId,
      reason,
      description
    };
    
    if (targetType === 'User') reportData.reportedUser = targetId;
    if (targetType === 'Post') reportData.reportedPost = targetId;
    if (targetType === 'Comment') reportData.reportedComment = targetId;

    const report = await Report.create(reportData);
    res.status(201).json({ status: 'success', data: { report } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

exports.getReports = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }
    
    const query = {};
    if (req.query.status) query.status = req.query.status;
    
    const reports = await Report.find(query)
      .populate('reporter', 'username displayName')
      .populate('reportedUser', 'username displayName')
      .sort('-createdAt');
      
    res.status(200).json({ status: 'success', results: reports.length, data: { reports } });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

exports.updateReportStatus = async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'moderator') {
      return res.status(403).json({ status: 'fail', message: 'Not authorized' });
    }

    const { status, resolutionNotes } = req.body;
    
    const updates = {
      status,
      resolutionNotes,
      resolvedBy: req.user._id,
    };
    
    if (status === 'resolved' || status === 'dismissed') {
      updates.resolvedAt = Date.now();
    }

    const report = await Report.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    
    if (!report) return res.status(404).json({ status: 'fail', message: 'Report not found' });
    
    res.status(200).json({ status: 'success', data: { report } });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};
