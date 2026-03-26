const Notification = require('../models/Notification');
const { AppError } = require('../middleware/errorHandler');

class NotificationController {
  async getNotifications(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      
      const notifications = await Notification.find({ recipient: req.user._id })
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .populate('sender', 'username avatar')
        .populate('post', 'content.text')
        .populate('comment', 'content');

      const unreadCount = await Notification.countDocuments({
        recipient: req.user._id,
        read: false,
      });

      res.status(200).json({
        status: 'success',
        results: notifications.length,
        data: { notifications, unreadCount },
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user._id },
        { read: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        return next(new AppError('Notification not found', 404));
      }

      res.status(200).json({ 
        status: 'success',
        data: { notification }
      });
    } catch (error) {
      next(error);
    }
  }

  async markAllAsRead(req, res, next) {
    try {
      const result = await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { read: true, readAt: new Date() }
      );

      res.status(200).json({ 
        status: 'success',
        message: `${result.modifiedCount} notifications marked as read`
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteNotification(req, res, next) {
    try {
      const notification = await Notification.findOneAndDelete({
        _id: req.params.id,
        recipient: req.user._id,
      });

      if (!notification) {
        return next(new AppError('Notification not found', 404));
      }

      res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  }

  async updatePreferences(req, res, next) {
    try {
      const { emailNotifications, pushNotifications, muteTypes } = req.body;
      
      const user = req.user;
      user.notificationPreferences = {
        email: emailNotifications,
        push: pushNotifications,
        muteTypes: muteTypes || [],
      };
      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        status: 'success',
        data: { preferences: user.notificationPreferences },
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();