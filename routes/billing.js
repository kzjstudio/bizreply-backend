import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../src/utils/logger.js';
import usageTrackingService from '../services/usage-tracking.service.js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * GET /api/billing/:businessId/usage/current
 * Get current month usage for a business
 */
router.get('/:businessId/usage/current', async (req, res) => {
  try {
    const { businessId } = req.params;

    const usage = await usageTrackingService.getCurrentMonthUsage(businessId);

    // Get subscription details
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        plan:subscription_plans(*)
      `)
      .eq('business_id', businessId)
      .single();

    if (subError && subError.code !== 'PGRST116') throw subError;

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

    const history = await usageTrackingService.getUsageHistory(businessId, months);

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

    const alerts = await usageTrackingService.getUnreadAlerts(businessId);

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
 * Create or update subscription
 */
router.post('/:businessId/subscription', async (req, res) => {
  try {
    const { businessId } = req.params;
    const { planId, billingCycle = 'monthly', fygaroCustomerId } = req.body;

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError) throw planError;

    // Calculate period dates
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    
    if (billingCycle === 'yearly') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    // Upsert subscription
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .upsert({
        business_id: businessId,
        plan_id: planId,
        fygaro_customer_id: fygaroCustomerId,
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

    res.json({ success: true, data: subscription });
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

export default router;
