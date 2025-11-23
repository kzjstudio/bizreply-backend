import express from 'express';
import { logger } from '../src/utils/logger.js';
import fygaroService from '../services/fygaro.service.js';

const router = express.Router();

/**
 * POST /api/webhooks/fygaro
 * Handle Fygaro webhook events
 */
router.post('/fygaro', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['fygaro-signature'] || req.headers['x-fygaro-signature'];
    
    // Verify webhook signature
    const isValid = fygaroService.verifyWebhookSignature(
      req.body.toString(),
      signature
    );

    if (!isValid) {
      logger.error('❌ Invalid Fygaro webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse event
    const event = JSON.parse(req.body.toString());
    
    logger.info(`📨 Fygaro webhook received: ${event.type}`);

    // Handle event
    const result = await fygaroService.handleWebhook(event);

    res.json({ received: true, result });
  } catch (error) {
    logger.error('Error processing Fygaro webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/webhooks/fygaro/test
 * Test endpoint to verify webhook is accessible
 */
router.get('/fygaro/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Fygaro webhook endpoint is accessible',
    configured: fygaroService.isConfigured()
  });
});

export default router;
