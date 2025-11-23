import express from 'express';
import instagramService from '../services/instagram.service.js';
import instagramAuthService from '../services/instagramAuth.service.js';
import { logger } from '../src/utils/logger.js';

const router = express.Router();

// GET verify endpoint for Meta webhook subscription
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.INSTAGRAM_VERIFY_TOKEN) {
    logger.info('✅ Instagram webhook verified');
    return res.status(200).send(challenge);
  }
  logger.warn('⚠️ Instagram webhook verification failed');
  return res.status(403).send('Verification failed');
});

// POST webhook receiver
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.body; // Buffer

    if (!instagramService.verifySignature(rawBody, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse JSON
    const body = JSON.parse(rawBody.toString());
    const result = await instagramService.handleWebhookEvent(body);
    res.status(200).json(result);
  } catch (error) {
    logger.error('Instagram webhook error:', error);
    res.status(500).json({ error: 'Internal error' });
  }
});

// Simple health/config endpoint
router.get('/status', (req, res) => {
  res.json({
    configured: instagramService.isConfigured(),
    graphVersion: instagramService.graphVersion
  });
});

// GET /api/instagram/connect?business_id=xyz
// Returns OAuth login URL & state
router.get('/connect', (req, res) => {
  try {
    const { business_id } = req.query;
    if (!business_id) return res.status(400).json({ error: 'Missing business_id' });
    const { url, state } = instagramAuthService.buildLoginUrl(business_id);
    res.json({ login_url: url, state, scopes: instagramAuthService.requiredScopes });
  } catch (e) {
    logger.error('Connect error:', e);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/instagram/callback?code=...&state=...
// Exchanges code -> short-lived -> long-lived token, fetch pages
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;
    if (oauthError) return res.status(400).json({ error: oauthError });
    if (!code || !state) return res.status(400).json({ error: 'Missing code or state' });
    const meta = instagramAuthService.validateState(state);
    if (!meta) return res.status(400).json({ error: 'Invalid or expired state' });

    const shortTokenData = await instagramAuthService.exchangeCodeForUserToken(code);
    const longTokenData = await instagramAuthService.upgradeToLongLivedToken(shortTokenData.access_token);
    const pagesData = await instagramAuthService.fetchUserPages(longTokenData.access_token);
    const pages = Array.isArray(pagesData.data) ? pagesData.data : [];
    const enriched = await instagramAuthService.enrichPagesWithInstagram(pages, longTokenData.access_token);

    res.json({
      business_id: meta.businessId,
      user_token_expires_in: longTokenData.expires_in,
      pages_found: enriched.length,
      pages: enriched.filter(p => p.instagram_business_account_id), // only those with IG attached
      all_pages: enriched,
      next_step: 'POST /api/instagram/select with page_id',
    });
  } catch (e) {
    logger.error('Callback error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/instagram/select { business_id, page_id }
// Persists selection & subscribes to page events
router.post('/select', express.json(), async (req, res) => {
  try {
    const { business_id, page_id, page_name, page_access_token, instagram_business_account_id } = req.body;
    if (!business_id || !page_id || !page_access_token) {
      return res.status(400).json({ error: 'Missing business_id, page_id or page_access_token' });
    }

    const page = {
      page_id,
      page_name: page_name || 'Instagram Page',
      page_access_token,
      instagram_business_account_id: instagram_business_account_id || null,
      perms: []
    };

    const record = await instagramAuthService.persistSelection({ businessId: business_id, page });
    const subscription = await instagramAuthService.subscribePage(page_id, page_access_token);

    res.json({
      success: true,
      instagram_account: record,
      subscription,
      message: 'Instagram page connected and subscribed.'
    });
  } catch (e) {
    logger.error('Select error:', e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
