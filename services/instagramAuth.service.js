import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../src/utils/logger.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * InstagramAuthService
 * Handles OAuth URL generation, code exchange, long-lived token retrieval,
 * page + instagram business account discovery, selection persistence, and
 * basic subscription to page events.
 * NOTE: Tokens are stored in plain text currently; encrypt before production hardening.
 */
class InstagramAuthService {
  constructor() {
    this.appId = process.env.INSTAGRAM_APP_ID; // Meta App ID
    this.appSecret = process.env.INSTAGRAM_APP_SECRET; // Meta App Secret
    this.redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'https://kzjinnovations.com/api/instagram/callback';
    this.graphVersion = process.env.META_GRAPH_API_VERSION || 'v18.0';
    this.requiredScopes = (process.env.INSTAGRAM_SCOPES || 'pages_show_list,pages_read_engagement,pages_read_user_content,instagram_basic,instagram_manage_messages,business_management').split(',');
    this.stateStore = new Map(); // ephemeral state -> metadata
  }

  buildLoginUrl(businessId) {
    if (!this.appId) throw new Error('Missing INSTAGRAM_APP_ID');
    const state = this.generateState(businessId);
    const scopes = encodeURIComponent(this.requiredScopes.join(','));
    return {
      url: `https://www.facebook.com/${this.graphVersion}/dialog/oauth?client_id=${this.appId}&redirect_uri=${encodeURIComponent(this.redirectUri)}&state=${state}&scope=${scopes}&auth_type=rerequest`,
      state
    };
  }

  generateState(businessId) {
    const raw = `${businessId}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const state = Buffer.from(raw).toString('base64url');
    this.stateStore.set(state, { businessId, createdAt: Date.now() });
    return state;
  }

  validateState(state) {
    const meta = this.stateStore.get(state);
    if (!meta) return null;
    // Expire after 10 minutes
    if (Date.now() - meta.createdAt > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      return null;
    }
    // One-time use
    this.stateStore.delete(state);
    return meta;
  }

  async exchangeCodeForUserToken(code) {
    const params = {
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      client_secret: this.appSecret,
      code
    };
    const url = `https://graph.facebook.com/${this.graphVersion}/oauth/access_token`;
    const { data } = await axios.get(url, { params });
    return data; // { access_token, token_type, expires_in }
  }

  async upgradeToLongLivedToken(shortLivedToken) {
    const params = {
      grant_type: 'fb_exchange_token',
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLivedToken
    };
    const url = `https://graph.facebook.com/${this.graphVersion}/oauth/access_token`;
    const { data } = await axios.get(url, { params });
    return data; // { access_token, token_type, expires_in }
  }

  async fetchUserPages(longLivedUserToken) {
    const url = `https://graph.facebook.com/${this.graphVersion}/me/accounts`;
    const { data } = await axios.get(url, { params: { access_token: longLivedUserToken } });
    return data; // { data: [ {id,name,access_token,perms,...} ] }
  }

  async enrichPagesWithInstagram(pages, userToken) {
    const enriched = [];
    for (const page of pages) {
      try {
        const pageDetailUrl = `https://graph.facebook.com/${this.graphVersion}/${page.id}`;
        const { data: detail } = await axios.get(pageDetailUrl, {
          params: { fields: 'instagram_business_account', access_token: userToken }
        });
        enriched.push({
          page_id: page.id,
          page_name: page.name,
          page_access_token: page.access_token,
          perms: page.perms,
          instagram_business_account_id: detail.instagram_business_account?.id || null
        });
      } catch (e) {
        logger.warn(`Failed to enrich page ${page.id}: ${e.message}`);
      }
    }
    return enriched;
  }

  async subscribePage(pageId, pageAccessToken) {
    try {
      const url = `https://graph.facebook.com/${this.graphVersion}/${pageId}/subscribed_apps`;
      const { data } = await axios.post(url, null, {
        params: {
          access_token: pageAccessToken,
          subscribed_fields: 'messages,feed' // feed includes comments; refine later
        }
      });
      return data; // { success: true }
    } catch (e) {
      logger.error('Page subscription error:', e.message);
      return { success: false, error: e.message };
    }
  }

  async persistSelection({ businessId, page }) {
    const expiresAt = new Date(Date.now() + (60 * 24 * 60 * 60 * 1000)).toISOString(); // approx 60 days long-lived
    const { data, error } = await supabase
      .from('instagram_accounts')
      .upsert({
        business_id: businessId,
        page_id: page.page_id,
        ig_business_id: page.instagram_business_account_id,
        page_name: page.page_name,
        access_token: page.page_access_token,
        status: 'active',
        user_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, { onConflict: 'business_id,page_id' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

const instagramAuthService = new InstagramAuthService();
export default instagramAuthService;