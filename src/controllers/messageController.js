const Message = require('../models/Message');
const User = require('../models/User');
const EncryptionService = require('../services/encryptionService');
const NotificationService = require('../services/notificationService');
const redis = require('../config/redis');

class MessageController {
  async sendMessage(req, res, next) {
    try {
      const { recipientId, content, replyTo, selfDestruct } = req.body;

      const recipient = await User.findById(recipientId);
      if (!recipient) {
        return res.status(404).json({
          status: 'fail',
          message: 'Recipient not found',
        });
      }

      if (recipient.privacySettings.allowMessages === 'none') {
        return res.status(403).json({
          status: 'fail',
          message: 'This user does not accept messages',
        });
      }

      if (recipient.privacySettings.allowMessages === 'friends') {
        const isFollowing = recipient.following.includes(req.user._id);
        if (!isFollowing) {
          return res.status(403).json({
            status: 'fail',
            message: 'You must be following each other to message',
          });
        }
      }

      const encryptedContent = EncryptionService.encryptMessage(
        content,
        recipient.publicKey
      );

      const message = await Message.create({
        sender: req.user._id,
        recipient: recipientId,
        content: encryptedContent,
        metadata: {
          messageType: 'text',
        },
        replyTo: replyTo ? { messageId: replyTo, preview: content.substring(0, 50) } : undefined,
        selfDestruct: selfDestruct ? {
          enabled: true,
          duration: selfDestruct,
        } : undefined,
      });

      NotificationService.notifyNewMessage(recipientId, {
        sender: req.user._id,
        preview: '🔒 Encrypted message',
      });

      res.status(201).json({
        status: 'success',
        data: {
          message: {
            _id: message._id,
            status: message.status,
            createdAt: message.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversation(req, res, next) {
    try {
      const { userId } = req.params;
      const { cursor, limit = 30 } = req.query;

      const query = {
        $or: [
          { sender: req.user._id, recipient: userId },
          { sender: userId, recipient: req.user._id },
        ],
        deletedFor: { $ne: req.user._id },
        deletedForEveryone: false,
      };

      if (cursor) {
        query.createdAt = { $lt: new Date(cursor) };
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .populate('sender', 'username avatar')
        .populate('recipient', 'username avatar');

      const decryptedMessages = messages.map(msg => {
        const isSender = msg.sender._id.toString() === req.user._id.toString();
        
        if (isSender) {
          return {
            ...msg.toObject(),
            content: '[Sent]', 
          };
        } else {
          return {
            ...msg.toObject(),
            content: {
              encrypted: true,
              data: msg.content,
            },
          };
        }
      });

      res.status(200).json({
        status: 'success',
        data: {
          messages: decryptedMessages.reverse(), 
          nextCursor: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const { messageId } = req.params;

      const message = await Message.findOneAndUpdate(
        {
          _id: messageId,
          recipient: req.user._id,
          status: { $ne: 'read' },
        },
        {
          status: 'read',
          readAt: new Date(),
        },
        { new: true }
      );

      if (message && message.selfDestruct?.enabled) {
        setTimeout(async () => {
          await Message.findByIdAndDelete(messageId);
        }, message.selfDestruct.duration * 1000);
      }

      res.status(200).json({
        status: 'success',
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteMessage(req, res, next) {
    try {
      const { messageId } = req.params;
      const { forEveryone } = req.body;

      const message = await Message.findById(messageId);
      if (!message) {
        return res.status(404).json({
          status: 'fail',
          message: 'Message not found',
        });
      }

      const isSender = message.sender.toString() === req.user._id.toString();
      const isRecipient = message.recipient.toString() === req.user._id.toString();

      if (!isSender && !isRecipient) {
        return res.status(403).json({
          status: 'fail',
          message: 'Not authorized',
        });
      }

      if (forEveryone && isSender) {
        const hoursSinceSent = (Date.now() - message.createdAt) / (1000 * 60 * 60);
        if (hoursSinceSent > 24) {
          return res.status(400).json({
            status: 'fail',
            message: 'Cannot delete for everyone after 24 hours',
          });
        }

        message.deletedForEveryone = true;
        message.deletedAt = new Date();
        await message.save();
      } else {
        message.deletedFor.push(req.user._id);
        await message.save();
      }

      res.status(204).json({
        status: 'success',
        data: null,
      });
    } catch (error) {
      next(error);
    }
  }

  async getConversationsList(req, res, next) {
    try {
      const conversations = await Message.aggregate([
        {
          $match: {
            $or: [
              { sender: req.user._id },
              { recipient: req.user._id },
            ],
            deletedFor: { $ne: req.user._id },
            deletedForEveryone: false,
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: {
              $cond: [
                { $eq: ['$sender', req.user._id] },
                '$recipient',
                '$sender',
              ],
            },
            lastMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  { $and: [
                    { $eq: ['$recipient', req.user._id] },
                    { $eq: ['$status', 'sent'] },
                  ]},
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            'user.password': 0,
            'user.twoFactorSecret': 0,
          },
        },
      ]);

      res.status(200).json({
        status: 'success',
        results: conversations.length,
        data: { conversations },
      });
    } catch (error) {
      next(error);
    }
  }

  async typingIndicator(req, res, next) {
    try {
      const { recipientId, isTyping } = req.body;

      // Ensure 'redis' is defined in your file imports if you are using it
      // await redis.publish(...)

      res.status(200).json({ status: 'success' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MessageController();