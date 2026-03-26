const Sticker = require('../models/Sticker');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const logger = require('../utils/logger');

class StickerController {
  /**
   * GET /stickers — Get all stickers, with optional category & search filter
   */
  getAllStickers = async (req, res, next) => {
    try {
      const {
        category,
        pack,
        search,
        page = 1,
        limit = 30,
      } = req.query;

      const query = { isActive: true, isOffensive: false };

      if (category) query.category = category;
      if (pack) query.pack = pack;
      if (search) query.$text = { $search: search };

      const stickers = await Sticker.find(query)
        .sort({ usageCount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-publicId -moderatedBy -moderationReason -__v');

      const total = await Sticker.countDocuments(query);

      // If user is authenticated, mark which stickers are in their collection
      let userCollection = [];
      if (req.user) {
        const user = await User.findById(req.user._id).select('stickerCollection');
        userCollection = (user?.stickerCollection || []).map(id => id.toString());
      }

      const enrichedStickers = stickers.map(s => ({
        ...s.toObject(),
        isCollected: userCollection.includes(s._id.toString()),
      }));

      res.status(200).json({
        status: 'success',
        results: stickers.length,
        total,
        pages: Math.ceil(total / limit),
        data: { stickers: enrichedStickers },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /stickers/:stickerId — Get single sticker by ID
   */
  getStickerById = async (req, res, next) => {
    try {
      const sticker = await Sticker.findById(req.params.stickerId).select('-publicId -moderatedBy -moderationReason');

      if (!sticker || !sticker.isActive) {
        return res.status(404).json({ status: 'fail', message: 'Sticker not found' });
      }

      res.status(200).json({ status: 'success', data: { sticker } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /stickers/categories — List all categories
   */
  getCategories = async (req, res, next) => {
    try {
      const categories = await Sticker.distinct('category', { isActive: true, isOffensive: false });
      res.status(200).json({ status: 'success', data: { categories } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /stickers — Admin creates a new sticker (upload to Cloudinary)
   */
  createSticker = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ status: 'fail', message: 'Sticker image is required' });
      }

      const { name, category, pack, tags, emoji, isAnimated } = req.body;

      // Upload to Cloudinary under stickers folder
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: 'stickers',
        resource_type: 'image',
        transformation: [{ width: 256, height: 256, crop: 'fit' }],
      });

      // Also create a thumbnail
      const thumbnailUrl = cloudinary.url(uploadResult.public_id, {
        width: 64, height: 64, crop: 'fit', fetch_format: 'auto',
      });

      const sticker = await Sticker.create({
        name,
        category: category || 'reactions',
        pack: pack || 'default',
        imageUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        thumbnailUrl,
        isAnimated: isAnimated === 'true',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        emoji,
        createdBy: req.user._id,
      });

      res.status(201).json({ status: 'success', data: { sticker } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /stickers/:stickerId — Admin deletes a sticker
   */
  deleteSticker = async (req, res, next) => {
    try {
      const sticker = await Sticker.findById(req.params.stickerId);
      if (!sticker) {
        return res.status(404).json({ status: 'fail', message: 'Sticker not found' });
      }

      // Remove from Cloudinary
      if (sticker.publicId) {
        await cloudinary.uploader.destroy(sticker.publicId, { resource_type: 'image' }).catch(() => {});
      }

      // Soft delete
      sticker.isActive = false;
      await sticker.save();

      res.status(204).json({ status: 'success', data: null });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /stickers/:stickerId/moderate — Admin flag sticker as offensive
   */
  moderateSticker = async (req, res, next) => {
    try {
      const { isOffensive, reason } = req.body;

      const sticker = await Sticker.findByIdAndUpdate(
        req.params.stickerId,
        {
          isOffensive: !!isOffensive,
          moderatedBy: req.user._id,
          moderatedAt: new Date(),
          moderationReason: reason || '',
        },
        { new: true }
      );

      if (!sticker) {
        return res.status(404).json({ status: 'fail', message: 'Sticker not found' });
      }

      logger.info(`Sticker "${sticker.name}" flagged as offensive: ${isOffensive} by ${req.user.username}`);

      res.status(200).json({ status: 'success', data: { sticker } });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /stickers/:stickerId/collect — Toggle sticker in user's personal collection
   */
  collectSticker = async (req, res, next) => {
    try {
      const { stickerId } = req.params;
      const userId = req.user._id;

      const sticker = await Sticker.findOne({ _id: stickerId, isActive: true, isOffensive: false });
      if (!sticker) {
        return res.status(404).json({ status: 'fail', message: 'Sticker not found or not available' });
      }

      const user = await User.findById(userId).select('stickerCollection');
      const alreadyCollected = user.stickerCollection.some(id => id.toString() === stickerId);

      let message;
      if (alreadyCollected) {
        // Remove from collection
        await User.findByIdAndUpdate(userId, { $pull: { stickerCollection: stickerId } });
        await Sticker.findByIdAndUpdate(stickerId, { $inc: { collectCount: -1 } });
        message = 'Sticker removed from collection';
      } else {
        // Add to collection
        await User.findByIdAndUpdate(userId, { $addToSet: { stickerCollection: stickerId } });
        await Sticker.findByIdAndUpdate(stickerId, { $inc: { collectCount: 1 } });
        message = 'Sticker added to collection';
      }

      res.status(200).json({
        status: 'success',
        message,
        data: { isCollected: !alreadyCollected, collectCount: sticker.collectCount },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /stickers/me/collection — Get the authenticated user's sticker collection
   */
  getMyCollection = async (req, res, next) => {
    try {
      const user = await User.findById(req.user._id)
        .select('stickerCollection')
        .populate({
          path: 'stickerCollection',
          match: { isActive: true, isOffensive: false },
          select: '-publicId -moderatedBy -moderationReason -__v',
        });

      const stickers = user?.stickerCollection || [];

      res.status(200).json({
        status: 'success',
        results: stickers.length,
        data: { stickers },
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new StickerController();
