import { supabase } from '../src/services/supabase.service.js';
import { logger } from '../src/utils/logger.js';

/**
 * Service for tracking OpenAI API usage
 * Tracks tokens, costs, and generates usage summaries
 */
class UsageTrackingService {
  constructor() {
    // OpenAI pricing per 1M tokens (as of 2024)
    this.pricing = {
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
      'gpt-3.5-turbo-16k': { input: 3.00, output: 4.00 },
      'text-embedding-ada-002': { input: 0.10, output: 0.10 }
    };
  }

  /**
   * Calculate cost based on model and token usage
   */
  calculateCost(model, tokensInput, tokensOutput) {
    const modelPricing = this.pricing[model] || this.pricing['gpt-3.5-turbo'];
    
    const costInput = (tokensInput / 1000000) * modelPricing.input;
    const costOutput = (tokensOutput / 1000000) * modelPricing.output;
    
    return {
      costInput: parseFloat(costInput.toFixed(6)),
      costOutput: parseFloat(costOutput.toFixed(6)),
      totalCost: parseFloat((costInput + costOutput).toFixed(6))
    };
  }

  /**
   * Track API usage for a business
   */
  async trackUsage({
    businessId,
    conversationId,
    model,
    tokensInput,
    tokensOutput,
    requestType = 'chat_completion',
    customerPhone = null,
    metadata = null
  }) {
    try {
      const costs = this.calculateCost(model, tokensInput, tokensOutput);

      const { data, error } = await supabase
        .from('api_usage')
        .insert({
          business_id: businessId,
          conversation_id: conversationId,
          model,
          tokens_input: tokensInput,
          tokens_output: tokensOutput,
          cost_input: costs.costInput,
          cost_output: costs.costOutput,
          request_type: requestType,
          customer_phone: customerPhone,
          metadata,
          timestamp: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`📊 Usage tracked: ${businessId} | ${model} | ${tokensInput + tokensOutput} tokens | $${costs.totalCost}`);

      // Check usage limits
      await this.checkUsageLimits(businessId);

      return data;
    } catch (error) {
      logger.error('Error tracking usage:', error);
      throw error;
    }
  }

  /**
   * Get current month usage for a business
   */
  async getCurrentMonthUsage(businessId) {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const { data, error } = await supabase
        .from('usage_summary')
        .select('*')
        .eq('business_id', businessId)
        .eq('year', year)
        .eq('month', month)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error

      return data || {
        total_requests: 0,
        total_messages: 0,
        total_tokens: 0,
        total_cost: 0
      };
    } catch (error) {
      logger.error('Error getting current month usage:', error);
      throw error;
    }
  }

  /**
   * Get usage history for a business
   */
  async getUsageHistory(businessId, months = 6) {
    try {
      const { data, error } = await supabase
        .from('usage_summary')
        .select('*')
        .eq('business_id', businessId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(months);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error getting usage history:', error);
      throw error;
    }
  }

  /**
   * Get detailed usage logs
   */
  async getUsageLogs(businessId, { limit = 100, offset = 0, startDate = null, endDate = null } = {}) {
    try {
      let query = supabase
        .from('api_usage')
        .select('*')
        .eq('business_id', businessId)
        .order('timestamp', { ascending: false });

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }
      if (endDate) {
        query = query.lte('timestamp', endDate);
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error getting usage logs:', error);
      throw error;
    }
  }

  /**
   * Check if business is approaching or exceeding usage limits
   */
  async checkUsageLimits(businessId) {
    try {
      // Get current subscription and plan
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('business_id', businessId)
        .single();

      if (subError || !subscription) return;

      const messageLimit = subscription.plan.message_limit;
      if (!messageLimit) return; // Unlimited plan

      // Get current usage
      const usage = await this.getCurrentMonthUsage(businessId);
      const usagePercentage = (usage.total_requests / messageLimit) * 100;

      // Create alerts at 80% and 100%
      if (usagePercentage >= 100 && !await this.hasAlert(businessId, 'limit_100')) {
        await this.createUsageAlert(businessId, {
          alertType: 'limit_100',
          thresholdPercentage: 100,
          title: 'Usage Limit Reached',
          message: `You've reached your monthly limit of ${messageLimit} messages. Upgrade your plan to continue using AI responses.`
        });
      } else if (usagePercentage >= 80 && !await this.hasAlert(businessId, 'limit_80')) {
        await this.createUsageAlert(businessId, {
          alertType: 'limit_80',
          thresholdPercentage: 80,
          title: 'Approaching Usage Limit',
          message: `You've used ${Math.round(usagePercentage)}% of your monthly limit (${usage.total_requests}/${messageLimit} messages).`
        });
      }
    } catch (error) {
      logger.error('Error checking usage limits:', error);
    }
  }

  /**
   * Check if an alert already exists for this month
   */
  async hasAlert(businessId, alertType) {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await supabase
        .from('usage_alerts')
        .select('id')
        .eq('business_id', businessId)
        .eq('alert_type', alertType)
        .gte('created_at', monthStart.toISOString())
        .single();

      return !!data;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a usage alert
   */
  async createUsageAlert(businessId, { alertType, thresholdPercentage, title, message }) {
    try {
      const { data, error } = await supabase
        .from('usage_alerts')
        .insert({
          business_id: businessId,
          alert_type: alertType,
          threshold_percentage: thresholdPercentage,
          title,
          message
        })
        .select()
        .single();

      if (error) throw error;

      logger.info(`🚨 Usage alert created: ${businessId} | ${alertType}`);

      return data;
    } catch (error) {
      logger.error('Error creating usage alert:', error);
      throw error;
    }
  }

  /**
   * Get unread alerts for a business
   */
  async getUnreadAlerts(businessId) {
    try {
      const { data, error } = await supabase
        .from('usage_alerts')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Error getting unread alerts:', error);
      throw error;
    }
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(alertId) {
    try {
      const { error } = await supabase
        .from('usage_alerts')
        .update({
          is_read: true,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
    } catch (error) {
      logger.error('Error marking alert as read:', error);
      throw error;
    }
  }

  /**
   * Check if business can make API calls (within limits)
   */
  async canMakeApiCall(businessId) {
    try {
      // Get current subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          status,
          plan:subscription_plans(message_limit)
        `)
        .eq('business_id', businessId)
        .single();

      if (subError || !subscription) {
        return { allowed: false, reason: 'No active subscription' };
      }

      if (subscription.status !== 'active' && subscription.status !== 'trial') {
        return { allowed: false, reason: 'Subscription not active' };
      }

      const messageLimit = subscription.plan.message_limit;
      if (!messageLimit) {
        return { allowed: true }; // Unlimited
      }

      // Check current usage
      const usage = await this.getCurrentMonthUsage(businessId);
      
      if (usage.total_requests >= messageLimit) {
        return { 
          allowed: false, 
          reason: 'Monthly message limit exceeded',
          usage: usage.total_requests,
          limit: messageLimit
        };
      }

      return { 
        allowed: true,
        usage: usage.total_requests,
        limit: messageLimit
      };
    } catch (error) {
      logger.error('Error checking API call permission:', error);
      return { allowed: true }; // Fail open to avoid breaking service
    }
  }
}

export default new UsageTrackingService();
