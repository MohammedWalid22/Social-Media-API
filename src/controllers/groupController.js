const Group = require('../models/Group');
const { AppError } = require('../middleware/errorHandler');

exports.createGroup = async (req, res, next) => {
  try {
    const { name, description, visibility } = req.body;
    
    const group = await Group.create({
      name,
      description,
      visibility,
      creator: req.user._id,
      admins: [req.user._id],
      members: [req.user._id]
    });

    res.status(201).json({ status: 'success', data: { group } });
  } catch (err) {
    next(err);
  }
};

exports.getGroups = async (req, res, next) => {
  try {
    const groups = await Group.find({ visibility: 'public' })
      .select('-members -admins')
      .sort('-createdAt');
    res.status(200).json({ status: 'success', results: groups.length, data: { groups } });
  } catch (err) {
    next(err);
  }
};

exports.getGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('creator admins', 'username displayName avatar')
      .populate({ path: 'members', select: 'username displayName avatar', options: { limit: 50 } });

    if (!group) return next(new AppError('Group not found', 404));

    // If private, only members can view
    const isMember = group.members.some(id => id._id.toString() === req.user._id.toString());
    if (group.visibility === 'private' && !isMember && req.user.role !== 'admin') {
      return next(new AppError('This is a private group', 403));
    }

    res.status(200).json({ status: 'success', data: { group } });
  } catch (err) {
    next(err);
  }
};

exports.joinGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return next(new AppError('Group not found', 404));

    if (group.members.includes(req.user._id)) {
      return res.status(400).json({ status: 'fail', message: 'Already a member' });
    }

    if (group.visibility === 'private') {
      return res.status(403).json({ status: 'fail', message: 'Cannot join a private group directly' });
    }

    group.members.push(req.user._id);
    await group.save();

    res.status(200).json({ status: 'success', message: 'Joined group successfully' });
  } catch (err) {
    next(err);
  }
};

exports.leaveGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return next(new AppError('Group not found', 404));

    group.members = group.members.filter(id => id.toString() !== req.user._id.toString());
    group.admins = group.admins.filter(id => id.toString() !== req.user._id.toString());
    
    await group.save();

    res.status(200).json({ status: 'success', message: 'Left group successfully' });
  } catch (err) {
    next(err);
  }
};
