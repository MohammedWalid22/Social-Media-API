const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const Webhook = require('../models/Webhook');
const logger = require('../utils/logger');

class WebhookService {
  /**
   * Register a new webhook for a user.
   * Auto-generates an HMAC secret.
   */
  async register(userId, { url, events, description }) {
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await Webhook.create({
      owner: userId,
      url,
      events,
      description,
      secret,
    });

    // Return with secret (only shown once)
    return { ...webhook.toObject(), secret };
  }

  /**
   * Dispatch an event to all subscribed webhooks.
   * Fires and forgets — never blocks the request.
   */
  async trigger(event, payload) {
    try {
      const webhooks = await Webhook.find({
        events: event,
        isActive: true,
        failureCount: { $lt: 10 },
      }).select('+secret');

      if (!webhooks.length) return;

      const body = JSON.stringify({
        event,
        timestamp: new Date().toISOString(),
        data: payload,
      });

      // Dispatch all in parallel — individual failures are isolated
      await Promise.allSettled(
        webhooks.map((wh) => this._deliver(wh, body, event))
      );
    } catch (err) {
      logger.error('WebhookService.trigger error:', err);
    }
  }

  /**
   * Internal HTTP delivery with HMAC signature.
   */
  async _deliver(webhook, body, event) {
    try {
      const signature = this._sign(webhook.secret, body);
      const parsed = new URL(webhook.url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const statusCode = await new Promise((resolve, reject) => {
        const req = transport.request(
          {
            hostname: parsed.hostname,
            port: parsed.port,
            path: parsed.pathname + parsed.search,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
              'X-Webhook-Event': event,
              'X-Webhook-Signature': `sha256=${signature}`,
              'X-Webhook-Timestamp': new Date().toISOString(),
              'User-Agent': 'SocialMediaAPI-Webhook/1.0',
            },
            timeout: 5000,
          },
          (res) => resolve(res.statusCode)
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        req.write(body);
        req.end();
      });

      // Update metadata
      await Webhook.findByIdAndUpdate(webhook._id, {
        lastTriggeredAt: new Date(),
        lastStatusCode: statusCode,
        // Reset failure count on success (2xx)
        ...(statusCode >= 200 && statusCode < 300
          ? { failureCount: 0 }
          : { $inc: { failureCount: 1 } }),
      });

      logger.info(`Webhook delivered: ${webhook.url} → ${statusCode}`);
    } catch (err) {
      logger.warn(`Webhook delivery failed: ${webhook.url} — ${err.message}`);
      await Webhook.findByIdAndUpdate(webhook._id, {
        $inc: { failureCount: 1 },
        lastStatusCode: 0,
      });
    }
  }

  /**
   * Generate HMAC-SHA256 signature for payload verification.
   */
  _sign(secret, body) {
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  /**
   * Verify incoming signature (for test endpoint).
   */
  verifySignature(secret, rawBody, signature) {
    const expected = `sha256=${this._sign(secret, rawBody)}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  /** Send a test payload to verify the endpoint works */
  async sendTest(webhook) {
    const body = JSON.stringify({
      event: 'webhook.test',
      timestamp: new Date().toISOString(),
      data: { message: 'This is a test delivery from Social Media API' },
    });
    await this._deliver(webhook, body, 'webhook.test');
  }

  async getByOwner(userId) {
    return Webhook.find({ owner: userId }).sort('-createdAt');
  }

  async delete(webhookId, userId) {
    return Webhook.findOneAndDelete({ _id: webhookId, owner: userId });
  }

  async toggleActive(webhookId, userId, isActive) {
    return Webhook.findOneAndUpdate(
      { _id: webhookId, owner: userId },
      { isActive, failureCount: isActive ? 0 : undefined },
      { new: true }
    );
  }
}

module.exports = new WebhookService();
