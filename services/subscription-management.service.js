import { supabase } from '../src/services/supabase.service.js';
import { logger } from '../src/utils/logger.js';
import notificationService from './notification.service.js';
import fygaroService from './fygaro.service.js';

/**
 * Subscription Management Service
 * Handles subscription renewals, expirations, and status updates
 */
class SubscriptionManagementService {
  constructor() {
    this.cronJob = null;
    this.checkInterval = 60 * 60 * 1000; // Check every hour (in milliseconds)
  }

  /**
   * Start the cron job to check subscriptions
   */
  startCronJob() {
    logger.info('🔄 Starting subscription management cron job...');
    
    // Run immediately on startup
    this.checkSubscriptions();
    
    // Then run every hour
    this.cronJob = setInterval(() => {
      this.checkSubscriptions();
    }, this.checkInterval);
    
    logger.info(`✅ Subscription cron job started (checking every ${this.checkInterval / 60000} minutes)`);
  }

  /**
   * Stop the cron job
   */
  stopCronJob() {
    if (this.cronJob) {
      clearInterval(this.cronJob);
      this.cronJob = null;
      logger.info('⏹️  Subscription cron job stopped');
    }
  }

  /**
   * Main function to check all subscriptions
   */
  async checkSubscriptions() {
    try {
      logger.info('🔍 Checking subscription statuses...');
      
      const now = new Date();
      
      // Get all active and trial subscriptions
      const { data: subscriptions, error } = await supabase
        .from('subscriptions')
        .select(`
          *,
          business:businesses(id, business_name, contact_email),
          plan:subscription_plans(name, tier, price_monthly, price_yearly)
        `)
        .in('status', ['active', 'trial', 'past_due']);

      if (error) {
        logger.error('Error fetching subscriptions:', error);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        logger.info('No subscriptions to check');
        return;
      }

      logger.info(`📊 Found ${subscriptions.length} subscriptions to check`);

      for (const subscription of subscriptions) {
        await this.processSubscription(subscription, now);
      }

      logger.info('✅ Subscription check completed');
    } catch (error) {
      logger.error('Error in subscription check:', error);
    }
  }

  /**
   * Process individual subscription
   */
  async processSubscription(subscription, now) {
    const periodEnd = new Date(subscription.current_period_end);
    const daysUntilExpiry = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
    
    try {
      // Check if subscription has expired
      if (now >= periodEnd) {
        await this.handleExpiredSubscription(subscription);
        return;
      }

      // Send renewal reminders
      if (daysUntilExpiry <= 7 && daysUntilExpiry > 0) {
        await this.sendRenewalReminder(subscription, daysUntilExpiry);
      }

      // Check trial expiration
      if (subscription.trial_end) {
        const trialEnd = new Date(subscription.trial_end);
        const daysUntilTrialEnd = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilTrialEnd <= 3 && daysUntilTrialEnd > 0) {
          await this.sendTrialEndingReminder(subscription, daysUntilTrialEnd);
        }
      }

    } catch (error) {
      logger.error(`Error processing subscription ${subscription.id}:`, error);
    }
  }

  /**
   * Handle expired subscription
   */
  async handleExpiredSubscription(subscription) {
    logger.warn(`⚠️  Subscription expired: ${subscription.business.business_name} (${subscription.id})`);

    // Check if it should be cancelled or renewed
    if (subscription.cancel_at_period_end) {
      // Cancel the subscription
      await this.cancelSubscription(subscription);
    } else {
      // Attempt auto-renewal
      await this.attemptRenewal(subscription);
    }
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(subscription) {
    try {
      // Downgrade to free plan
      const { data: freePlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('tier', 'free')
        .single();

      if (planError) throw planError;

      // Update subscription to free plan with cancelled status
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          plan_id: freePlan.id,
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      logger.info(`✅ Subscription cancelled and downgraded to free plan: ${subscription.business.business_name}`);

      // Send notification to business owner
      await notificationService.sendSubscriptionCancelledNotification(
        subscription.business_id,
        {
          businessName: subscription.business.business_name,
          planName: subscription.plan.name,
          reason: 'Subscription period ended'
        }
      );

    } catch (error) {
      logger.error('Error cancelling subscription:', error);
    }
  }

  /**
   * Attempt to renew subscription
   */
  async attemptRenewal(subscription) {
    try {
      logger.info(`🔄 Attempting renewal for: ${subscription.business.business_name}`);

      // Check if Fygaro is configured and customer has payment method
      if (!fygaroService.isConfigured()) {
        logger.warn('⚠️  Fygaro not configured, marking subscription as past_due');
        await this.markSubscriptionPastDue(subscription);
        return;
      }

      if (!subscription.fygaro_customer_id) {
        logger.warn(`⚠️  No Fygaro customer ID for ${subscription.business.business_name}`);
        await this.markSubscriptionPastDue(subscription);
        return;
      }

      // Attempt to charge via Fygaro
      const paymentResult = await fygaroService.chargeSubscription(subscription);

      if (paymentResult.success) {
        // Payment successful - renew subscription
        logger.info(`✅ Payment successful for ${subscription.business.business_name}`);
        await this.renewSubscriptionPeriod(subscription, paymentResult);
      } else {
        // Payment failed - mark as past_due
        logger.error(`❌ Payment failed for ${subscription.business.business_name}: ${paymentResult.error}`);
        await this.markSubscriptionPastDue(subscription, paymentResult.error);
      }

    } catch (error) {
      logger.error('Error attempting renewal:', error);
      await this.markSubscriptionPastDue(subscription, error.message);
    }
  }

  /**
   * Mark subscription as past_due
   */
  async markSubscriptionPastDue(subscription, failureReason = 'Payment method required') {
    try {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      logger.warn(`⚠️  Subscription marked as past_due: ${subscription.business.business_name}`);

      // Send notification
      await notificationService.sendPaymentFailedNotification(
        subscription.business_id,
        {
          businessName: subscription.business.business_name,
          planName: subscription.plan.name,
          amount: subscription.billing_cycle === 'yearly' 
            ? subscription.plan.price_yearly 
            : subscription.plan.price_monthly,
          billingCycle: subscription.billing_cycle,
          failureReason
        }
      );
    } catch (error) {
      logger.error('Error marking subscription past_due:', error);
    }
  }

  /**
   * Renew subscription period (after successful payment)
   */
  async renewSubscriptionPeriod(subscription, paymentResult = null) {
    try {
      const newPeriodStart = new Date(subscription.current_period_end);
      const newPeriodEnd = new Date(newPeriodStart);

      if (subscription.billing_cycle === 'yearly') {
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
      } else {
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          current_period_start: newPeriodStart.toISOString(),
          current_period_end: newPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscription.id);

      if (error) throw error;

      logger.info(`✅ Subscription renewed: ${subscription.business.business_name}`);

      // Send success notification
      await notificationService.sendRenewalSuccessNotification(
        subscription.business_id,
        {
          businessName: subscription.business.business_name,
          planName: subscription.plan.name,
          nextBillingDate: newPeriodEnd.toISOString()
        }
      );

      // Create invoice record
      await this.createInvoice(subscription, newPeriodStart, newPeriodEnd, paymentResult);

    } catch (error) {
      logger.error('Error renewing subscription period:', error);
    }
  }

  /**
   * Create invoice for renewal
   */
  async createInvoice(subscription, periodStart, periodEnd, paymentResult = null) {
    try {
      const amount = subscription.billing_cycle === 'yearly'
        ? subscription.plan.price_yearly
        : subscription.plan.price_monthly;

      const invoiceNumber = `INV-${Date.now()}-${subscription.business_id.substring(0, 8)}`;

      const invoiceData = {
        business_id: subscription.business_id,
        subscription_id: subscription.id,
        invoice_number: invoiceNumber,
        subscription_amount: amount,
        usage_amount: 0,
        tax_amount: 0,
        total_amount: amount,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        status: 'paid',
        paid_at: new Date().toISOString()
      };

      // Add Fygaro payment details if available
      if (paymentResult && paymentResult.chargeId) {
        invoiceData.fygaro_payment_intent_id = paymentResult.chargeId;
        invoiceData.payment_method = 'fygaro';
      }

      const { error } = await supabase
        .from('invoices')
        .insert(invoiceData);

      if (error) throw error;

      logger.info(`📄 Invoice created: ${invoiceNumber}`);
    } catch (error) {
      logger.error('Error creating invoice:', error);
    }
  }

  /**
   * Send renewal reminder (7 days before expiry)
   */
  async sendRenewalReminder(subscription, daysRemaining) {
    try {
      // Check if we already sent a reminder for this period
      const reminderKey = `renewal_reminder_${subscription.id}_${subscription.current_period_end}`;
      const alreadySent = await this.checkNotificationSent(reminderKey);

      if (alreadySent) return;

      logger.info(`📧 Sending renewal reminder: ${subscription.business.business_name} (${daysRemaining} days)`);

      await notificationService.sendRenewalReminderNotification(
        subscription.business_id,
        {
          businessName: subscription.business.business_name,
          planName: subscription.plan.name,
          daysRemaining,
          amount: subscription.billing_cycle === 'yearly' 
            ? subscription.plan.price_yearly 
            : subscription.plan.price_monthly,
          billingCycle: subscription.billing_cycle,
          renewalDate: subscription.current_period_end
        }
      );

      await this.markNotificationSent(reminderKey);
    } catch (error) {
      logger.error('Error sending renewal reminder:', error);
    }
  }

  /**
   * Send trial ending reminder
   */
  async sendTrialEndingReminder(subscription, daysRemaining) {
    try {
      const reminderKey = `trial_reminder_${subscription.id}_${subscription.trial_end}`;
      const alreadySent = await this.checkNotificationSent(reminderKey);

      if (alreadySent) return;

      logger.info(`📧 Sending trial ending reminder: ${subscription.business.business_name} (${daysRemaining} days)`);

      await notificationService.sendTrialEndingNotification(
        subscription.business_id,
        {
          businessName: subscription.business.business_name,
          planName: subscription.plan.name,
          daysRemaining,
          trialEndDate: subscription.trial_end
        }
      );

      await this.markNotificationSent(reminderKey);
    } catch (error) {
      logger.error('Error sending trial reminder:', error);
    }
  }

  /**
   * Check if notification was already sent (simple in-memory cache)
   */
  async checkNotificationSent(key) {
    // TODO: Use Redis or database for persistent storage
    // For now, using simple check - will send once per cron cycle
    return false;
  }

  /**
   * Mark notification as sent
   */
  async markNotificationSent(key) {
    // TODO: Store in Redis or database
    // For now, no-op
  }

  /**
   * Get subscription status summary
   */
  async getSubscriptionsSummary() {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status');

      if (error) throw error;

      const summary = {
        total: data.length,
        active: data.filter(s => s.status === 'active').length,
        trial: data.filter(s => s.status === 'trial').length,
        past_due: data.filter(s => s.status === 'past_due').length,
        cancelled: data.filter(s => s.status === 'cancelled').length
      };

      return summary;
    } catch (error) {
      logger.error('Error getting subscription summary:', error);
      return null;
    }
  }
}

export default new SubscriptionManagementService();
