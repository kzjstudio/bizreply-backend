import fetch from 'node-fetch';
import crypto from 'crypto';
import { logger } from '../src/utils/logger.js';
import aiEngine from './aiEngine.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Instagram Messaging Service
 * - Verifies webhook signatures
 * - Parses Instagram DM events
 * - Sends AI-generated replies
 * - Persists conversations/messages in Supabase
 */
class InstagramService {
  constructor() {
    this.pageAccessToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;
    this.appSecret = process.env.INSTAGRAM_APP_SECRET;
    this.verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;
    this.graphVersion = process.env.META_GRAPH_API_VERSION || 'v18.0';
  }

  isConfigured() {
    return !!(this.pageAccessToken && this.appSecret);
  }

  /**
   * Verify X-Hub-Signature-256 header using HMAC SHA256
   */
  verifySignature(rawBody, signatureHeader) {
    try {
      if (!this.appSecret) {
        logger.warn('Instagram app secret not set, skipping signature verification');
        return true; // allow in dev
      }
      if (!signatureHeader) {
        logger.warn('Missing X-Hub-Signature-256 header');
        return false;
      }
      const expected = 'sha256=' + crypto
        .createHmac('sha256', this.appSecret)
        .update(rawBody)
        .digest('hex');
      const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
      if (!valid) logger.warn('Invalid Instagram webhook signature');
      return valid;
    } catch (error) {
      logger.error('Error verifying Instagram signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook payload (already parsed JSON)
   */
  async handleWebhookEvent(body) {
    if (!body || !body.entry) return { ignored: true };

    const responses = [];
    for (const entry of body.entry) {
      if (!entry.messaging) continue; // Instagram uses messaging array similar to FB Messenger when subscribed
      for (const event of entry.messaging) {
        if (event.message && event.sender && event.sender.id) {
          const senderId = event.sender.id;
          const text = event.message.text;
          if (!text) continue;
          const result = await this.processIncomingDM(senderId, text);
          responses.push(result);
        }
      }
    }
    return { processed: responses.length, responses };
  }

  /**
   * Process a single DM: store, generate AI reply, send.
   */
  async processIncomingDM(instagramUserId, text) {
    try {
      logger.info(`📩 IG DM from ${instagramUserId}: ${text}`);

      const conversation = await this.getOrCreateConversation(instagramUserId);
      await this.saveMessage(conversation.id, 'inbound', text, instagramUserId);

      const business = await this.getBusiness(conversation.business_id);
      if (!business.ai_enabled) {
        logger.info('AI disabled for business; skipping auto-reply');
        return { skipped: true };
      }

      const aiResult = await aiEngine.generateResponse(
        conversation.business_id,
        conversation.id,
        text
      );

      await this.sendInstagramMessage(instagramUserId, aiResult.response);
      await this.saveMessage(conversation.id, 'outbound', aiResult.response, 'ai');

      await this.updateConversation(conversation.id, {
        last_message_at: new Date().toISOString(),
        status: 'active'
      });

      return {
        success: true,
        conversationId: conversation.id,
        responsePreview: aiResult.response.substring(0, 80)
      };
    } catch (error) {
      logger.error('Error processing Instagram DM:', error);
      // Fallback reply
      try {
        await this.sendInstagramMessage(instagramUserId, "I'm having trouble right now. A team member will follow up shortly.");
      } catch (e) {
        logger.error('Failed sending fallback IG reply:', e);
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Create or fetch conversation mapped by instagram_user_id
   */
  async getOrCreateConversation(instagramUserId) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('instagram_user_id', instagramUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) return existing;

    // For now, map all IG DMs to a single business (could expand with lookup table)
    // Expect an environment override IG_DEFAULT_BUSINESS_ID or fallback to first active business
    const defaultBusinessId = process.env.IG_DEFAULT_BUSINESS_ID || await this.getFirstBusinessId();
    const { data: conversation, error } = await supabase
      .from('conversations')
      .insert({
        business_id: defaultBusinessId,
        instagram_user_id: instagramUserId,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    if (error) throw error;
    return conversation;
  }

  async getFirstBusinessId() {
    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('ai_enabled', true)
      .limit(1);
    return data && data[0] ? data[0].id : null;
  }

  async saveMessage(conversationId, direction, text, sender) {
    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        direction,
        message_text: text,
        sender,
        channel: 'instagram',
        timestamp: new Date().toISOString()
      });
    if (error) logger.error('Error saving IG message:', error);
  }

  async updateConversation(conversationId, updates) {
    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', conversationId);
    if (error) logger.error('Error updating IG conversation:', error);
  }

  async getBusiness(businessId) {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Send message via Instagram Messaging API (Graph)
   * For Instagram, you reply via the Facebook Messenger endpoint using the user's PSID
   */
  async sendInstagramMessage(userPsid, text) {
    if (!this.pageAccessToken) throw new Error('Missing Instagram Page Access Token');

    const url = `https://graph.facebook.com/${this.graphVersion}/me/messages`;
    const payload = {
      recipient: { id: userPsid },
      message: { text }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.pageAccessToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Instagram send error ${response.status}: ${errText}`);
    }

    const json = await response.json();
    logger.info(`✅ IG reply sent: mid=${json.message_id || json.id}`);
    return json;
  }
}

const instagramService = new InstagramService();
export default instagramService;
