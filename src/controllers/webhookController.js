const Webhook = require('../models/Webhook');
const WebhookService = require('../services/webhookService');
const { AppError } = require('../middleware/errorHandler');

class WebhookController {
  /** POST /api/v1/webhooks */
  async create(req, res, next) {
    try {
      const { url, events, description } = req.body;

      if (!url || !events?.length) {
        return next(new AppError('url and events are required', 400));
      }

      // Validate URL format
      try { new URL(url); } catch {
        return next(new AppError('Invalid webhook URL', 400));
      }

      // Max 10 webhooks per user
      const count = await Webhook.countDocuments({ owner: req.user._id });
      if (count >= 10) {
        return next(new AppError('Maximum of 10 webhooks per account', 400));
      }

      const webhook = await WebhookService.register(req.user._id, { url, events, description });

      res.status(201).json({
        status: 'success',
        message: '⚠️ Save your secret now — it will not be shown again.',
        data: { webhook },
      });
    } catch (err) {
      next(err);
    }
  }

  /** GET /api/v1/webhooks */
  async getAll(req, res, next) {
    try {
      const webhooks = await WebhookService.getByOwner(req.user._id);
      res.status(200).json({ status: 'success', results: webhooks.length, data: { webhooks } });
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /api/v1/webhooks/:id */
  async remove(req, res, next) {
    try {
      const deleted = await WebhookService.delete(req.params.id, req.user._id);
      if (!deleted) return next(new AppError('Webhook not found', 404));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /api/v1/webhooks/:id/toggle */
  async toggle(req, res, next) {
    try {
      const { isActive } = req.body;
      const webhook = await WebhookService.toggleActive(req.params.id, req.user._id, isActive);
      if (!webhook) return next(new AppError('Webhook not found', 404));
      res.status(200).json({ status: 'success', data: { webhook } });
    } catch (err) {
      next(err);
    }
  }

  /** POST /api/v1/webhooks/:id/test */
  async test(req, res, next) {
    try {
      const webhook = await Webhook.findOne({ _id: req.params.id, owner: req.user._id }).select('+secret');
      if (!webhook) return next(new AppError('Webhook not found', 404));

      // Fire without awaiting (async test)
      WebhookService.sendTest(webhook).catch(() => {});

      res.status(200).json({
        status: 'success',
        message: 'Test payload dispatched. Check your endpoint within 5 seconds.',
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WebhookController();
