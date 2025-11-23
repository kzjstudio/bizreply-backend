import express from 'express';
import { supabase } from '../src/services/supabase.service.js';
import { logger } from '../src/utils/logger.js';
import usageTrackingService from '../services/usage-tracking.service.js';
import fygaroService from '../services/fygaro.service.js';

const router = express.Router();

/**
 * GET /api/billing/:businessId/usage/current
 * Get current month usage for a business
 */
router.get('/:businessId/usage/current', async (req, res) => {
  try {
    const { businessId } = req.params;

    // Check if tables exist, if not return default data
    let usage, subscription;
    
    try {
      usage = await usageTrackingService.getCurrentMonthUsage(businessId);
    } catch (err) {
      logger.warn('Usage tables not found, returning default data. Run billing_and_usage_schema.sql migration.');
      usage = {
        total_requests: 0,
        total_messages: 0,
        total_tokens: 0,
        total_tokens_input: 0,
        total_tokens_output: 0,
        total_cost: 0
      };
    }

    // Get subscription details
    try {
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('business_id', businessId)
        .single();

      if (subError && subError.code !== 'PGRST116') throw subError;
      subscription = sub;
    } catch (err) {
      logger.warn('Subscription tables not found, returning null. Run billing_and_usage_schema.sql migration.');
      subscription = null;
    }

    const response = {
      success: true,
      data: {
        usage,
        subscription: subscription || null,
        usagePercentage: subscription?.plan?.message_limit 
          ? (usage.total_requests / subscription.plan.message_limit) * 100 
          : 0
      }
    };

    res.json(response);
  } catch (error) {
    logger.error('Error fetching current usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/:businessId/usage/history
 * Get usage history for a business
 */
router.get('/:businessId/usage/history', async (req, res) => {
  try {
    const { businessId } = req.params;
    const months = parseInt(req.query.months) || 6;

    let history;
    try {
      history = await usageTrackingService.getUsageHistory(businessId, months);
    } catch (err) {
      logger.warn('Usage tables not found, returning empty history. Run billing_and_usage_schema.sql migration.');
      history = [];
    }

    res.json({ success: true, data: history });
  } catch (error) {
    logger.error('Error fetching usage history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/:businessId/usage/logs
 * Get detailed usage logs
 */
router.get('/:businessId/usage/logs', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { limit = 100, offset = 0, startDate, endDate } = req.query;

    const logs = await usageTrackingService.getUsageLogs(businessId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Error fetching usage logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/:businessId/alerts
 * Get unread usage alerts
 */
router.get('/:businessId/alerts', async (req, res) => {
  try {
    const { businessId } = req.params;

    let alerts;
    try {
      alerts = await usageTrackingService.getUnreadAlerts(businessId);
    } catch (err) {
      logger.warn('Alert tables not found, returning empty alerts. Run billing_and_usage_schema.sql migration.');
      alerts = [];
    }

    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/:businessId/alerts/:alertId/read
 * Mark alert as read
 */
router.post('/:businessId/alerts/:alertId/read', async (req, res) => {
  try {
    const { alertId } = req.params;

    await usageTrackingService.markAlertAsRead(alertId);

    res.json({ success: true, message: 'Alert marked as read' });
  } catch (error) {
    logger.error('Error marking alert as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/plans
 * Get all subscription plans
 */
router.get('/plans', async (req, res) => {
  try {
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly', { ascending: true });

    if (error) throw error;

    res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('Error fetching plans:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/:businessId/subscription
 * Get subscription details
 */
router.get('/:businessId/subscription', async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    res.json({ success: true, data: subscription || null });
  } catch (error) {
    logger.error('Error fetching subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/:businessId/subscription
 * Create or update subscription with Fygaro integration
 */
router.post('/:businessId/subscription', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { planId, billingCycle = 'monthly', fygaroCustomerId, createFygaroCustomer = true } = req.body;

    // Get business details
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('business_name, contact_email, contact_phone')
      .eq('id', businessId)
      .single();

    if (businessError) throw businessError;

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError) throw planError;

    let finalFygaroCustomerId = fygaroCustomerId;
    let fygaroSubscriptionId = null;

    // Create Fygaro customer if needed and Fygaro is configured
    if (fygaroService.isConfigured() && createFygaroCustomer && !finalFygaroCustomerId) {
      logger.info(`Creating Fygaro customer for ${business.business_name}`);
      
      const customerResult = await fygaroService.createCustomer({
        email: business.contact_email,
        name: business.business_name,
        phone: business.contact_phone,
        businessId: businessId,
        metadata: {
          plan_name: plan.name,
          plan_tier: plan.tier
        }
      });

      if (customerResult.success) {
        finalFygaroCustomerId = customerResult.customerId;
        logger.info(`✅ Fygaro customer created: ${finalFygaroCustomerId}`);
      } else {
        logger.warn(`⚠️  Failed to create Fygaro customer: ${customerResult.error}`);
      }
    }

    // Create Fygaro subscription if customer exists
    if (fygaroService.isConfigured() && finalFygaroCustomerId) {
      const amount = billingCycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
      
      const subscriptionResult = await fygaroService.createSubscription({
        customerId: finalFygaroCustomerId,
        planName: plan.name,
        amount: amount,
        interval: billingCycle === 'yearly' ? 'year' : 'month',
        metadata: {
          business_id: businessId,
          plan_id: planId,
          plan_tier: plan.tier
        }
      });

      if (subscriptionResult.success) {
        fygaroSubscriptionId = subscriptionResult.subscriptionId;
        logger.info(`✅ Fygaro subscription created: ${fygaroSubscriptionId}`);
      } else {
        logger.warn(`⚠️  Failed to create Fygaro subscription: ${subscriptionResult.error}`);
      }
    }

    // Calculate period dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    
    if (billingCycle === 'yearly') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    // Upsert subscription in database
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .upsert({
        business_id: businessId,
        plan_id: planId,
        fygaro_customer_id: finalFygaroCustomerId,
        fygaro_subscription_id: fygaroSubscriptionId,
        status: 'active',
        billing_cycle: billingCycle,
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'business_id' })
      .select()
      .single();

    if (error) throw error;

    logger.info(`✅ Subscription created/updated for business ${businessId} | Plan: ${plan.name}`);

    res.json({ 
      success: true, 
      data: subscription,
      fygaroIntegrated: !!finalFygaroCustomerId
    });
  } catch (error) {
    logger.error('Error creating subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/:businessId/subscription/cancel
 * Cancel subscription at period end
 */
router.post('/:businessId/subscription/cancel', async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: true,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('business_id', businessId)
      .select()
      .single();

    if (error) throw error;

    logger.info(`❌ Subscription cancelled for business ${businessId}`);

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Error cancelling subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/:businessId/invoices
 * Get invoices for a business
 */
router.get('/:businessId/invoices', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { limit = 12, offset = 0 } = req.query;

    const { data: invoices, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({ success: true, data: invoices || [] });
  } catch (error) {
    logger.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/:businessId/subscription/status
 * Get detailed subscription status including renewal info
 */
router.get('/:businessId/subscription/status', async (req, res) => {
  try {
    const { businessId } = req.params;

    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('business_id', businessId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!subscription) {
      return res.json({
        success: true,
        data: {
          hasSubscription: false,
          status: 'none'
        }
      });
    }

    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const daysUntilRenewal = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
    
    let trialDaysRemaining = null;
    if (subscription.trial_end) {
      const trialEnd = new Date(subscription.trial_end);
      trialDaysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
    }

    const statusInfo = {
      hasSubscription: true,
      subscription: subscription,
      status: subscription.status,
      isActive: subscription.status === 'active' || subscription.status === 'trial',
      willRenew: !subscription.cancel_at_period_end,
      daysUntilRenewal,
      renewalDate: subscription.current_period_end,
      trialDaysRemaining,
      isExpiringSoon: daysUntilRenewal <= 7 && daysUntilRenewal > 0,
      isExpired: now >= periodEnd
    };

    res.json({ success: true, data: statusInfo });
  } catch (error) {
    logger.error('Error fetching subscription status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
