import { supabase } from '../src/services/supabase.service.js';
import { logger } from '../src/utils/logger.js';

/**
 * Service for sending notifications to business owners
 * Handles email, push notifications, and SMS alerts
 */
class NotificationService {
  /**
   * Send usage limit notification to business owner
   */
  async sendUsageLimitAlert(businessId, alertData) {
    try {
      // Get business owner details
      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .select(`
          business_name,
          contact_email,
          contact_phone,
          owner_id
        `)
        .eq('id', businessId)
        .single();

      if (businessError || !business) {
        logger.error(`Failed to get business for notification: ${businessId}`);
        return;
      }

      const { usage, limit, percentage, plan } = alertData;

      // Log notification (to be replaced with actual email/SMS service)
      logger.warn(`
╔═══════════════════════════════════════════════════════════╗
║           🚨 USAGE LIMIT ALERT 🚨                         ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Plan: ${(plan || 'Unknown').padEnd(51)}║
║ Usage: ${usage}/${limit} messages (${percentage}%)${' '.repeat(Math.max(0, 21 - usage.toString().length - limit.toString().length - percentage.toString().length))}║
║                                                           ║
║ ACTION REQUIRED:                                          ║
║ Your AI assistant will send basic responses until you    ║
║ upgrade your plan. Customers will be directed to         ║
║ contact you directly for assistance.                     ║
║                                                           ║
║ 📧 Upgrade Now: https://bizreply.ai/billing             ║
╚═══════════════════════════════════════════════════════════╝
      `);

      // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
      // Example implementation:
      /*
      const emailContent = {
        to: business.contact_email,
        subject: `Usage Limit Alert - ${business.business_name}`,
        html: this.generateLimitEmailHTML(business, alertData)
      };
      await sendEmail(emailContent);
      */

      // TODO: Send push notification via Firebase or OneSignal
      /*
      const pushNotification = {
        userId: business.owner_id,
        title: 'Usage Limit Reached',
        body: `You've used ${percentage}% of your monthly AI message limit.`,
        data: { businessId, screen: 'billing' }
      };
      await sendPushNotification(pushNotification);
      */

      // Log notification sent
      await this.logNotification(businessId, {
        type: 'usage_limit_alert',
        channel: 'console', // Change to 'email', 'push', 'sms' when integrated
        recipient: business.contact_email,
        data: alertData,
        status: 'sent'
      });

    } catch (error) {
      logger.error('Error sending usage limit alert:', error);
    }
  }

  /**
   * Send escalation notification to business owner
   */
  async sendEscalationAlert(businessId, escalationData) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('business_name, contact_email, contact_phone')
        .eq('id', businessId)
        .single();

      if (error || !business) return;

      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           🚨 CUSTOMER ESCALATION ALERT 🚨                 ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Customer: ${escalationData.customerPhone.padEnd(47)}║
║ Reason: ${escalationData.reason.padEnd(49)}║
║                                                           ║
║ A customer has requested to speak with a human.          ║
║ Please respond via the admin dashboard or WhatsApp.      ║
║                                                           ║
║ 📱 Open Dashboard: https://bizreply.ai/conversations    ║
╚═══════════════════════════════════════════════════════════╝
      `);

      // TODO: Send actual email/SMS notification
      
      await this.logNotification(businessId, {
        type: 'escalation_alert',
        channel: 'console',
        recipient: business.contact_email,
        data: escalationData,
        status: 'sent'
      });

    } catch (error) {
      logger.error('Error sending escalation alert:', error);
    }
  }

  /**
   * Log notification for audit trail
   */
  async logNotification(businessId, notificationData) {
    try {
      // For now, just log to console
      // In production, store in a notifications table
      logger.info(`📧 Notification logged: ${businessId} | ${notificationData.type}`);
    } catch (error) {
      logger.error('Error logging notification:', error);
    }
  }

  /**
   * Send renewal reminder notification
   */
  async sendRenewalReminderNotification(businessId, renewalData) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('business_name, contact_email')
        .eq('id', businessId)
        .single();

      if (error || !business) return;

      const { daysRemaining, planName, amount, renewalDate } = renewalData;

      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           📅 RENEWAL REMINDER                             ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Plan: ${planName.padEnd(51)}║
║ Renewal in: ${daysRemaining} days${' '.repeat(45 - daysRemaining.toString().length)}║
║ Amount: $${amount}${' '.repeat(50 - amount.toString().length)}║
║                                                           ║
║ Your subscription will renew automatically on:           ║
║ ${new Date(renewalDate).toLocaleDateString()}${' '.repeat(43 - new Date(renewalDate).toLocaleDateString().length)}║
╚═══════════════════════════════════════════════════════════╝
      `);

      await this.logNotification(businessId, {
        type: 'renewal_reminder',
        channel: 'console',
        recipient: business.contact_email,
        data: renewalData,
        status: 'sent'
      });
    } catch (error) {
      logger.error('Error sending renewal reminder:', error);
    }
  }

  /**
   * Send trial ending notification
   */
  async sendTrialEndingNotification(businessId, trialData) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('business_name, contact_email')
        .eq('id', businessId)
        .single();

      if (error || !business) return;

      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           ⏰ TRIAL ENDING SOON                            ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Trial ends in: ${trialData.daysRemaining} days${' '.repeat(38 - trialData.daysRemaining.toString().length)}║
║                                                           ║
║ Add a payment method to continue using ${trialData.planName}${' '.repeat(17 - trialData.planName.length)}║
╚═══════════════════════════════════════════════════════════╝
      `);

      await this.logNotification(businessId, {
        type: 'trial_ending',
        channel: 'console',
        recipient: business.contact_email,
        data: trialData,
        status: 'sent'
      });
    } catch (error) {
      logger.error('Error sending trial ending notification:', error);
    }
  }

  /**
   * Send payment failed notification
   */
  async sendPaymentFailedNotification(businessId, paymentData) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('business_name, contact_email')
        .eq('id', businessId)
        .single();

      if (error || !business) return;

      logger.warn(`
╔═══════════════════════════════════════════════════════════╗
║           ❌ PAYMENT FAILED                               ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Plan: ${paymentData.planName.padEnd(51)}║
║ Amount: $${paymentData.amount}${' '.repeat(50 - paymentData.amount.toString().length)}║
║                                                           ║
║ Your subscription renewal payment failed.                ║
║ Please update your payment method to continue service.   ║
║                                                           ║
║ 💳 Update Payment: https://bizreply.ai/billing          ║
╚═══════════════════════════════════════════════════════════╝
      `);

      await this.logNotification(businessId, {
        type: 'payment_failed',
        channel: 'console',
        recipient: business.contact_email,
        data: paymentData,
        status: 'sent'
      });
    } catch (error) {
      logger.error('Error sending payment failed notification:', error);
    }
  }

  /**
   * Send renewal success notification
   */
  async sendRenewalSuccessNotification(businessId, renewalData) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('business_name, contact_email')
        .eq('id', businessId)
        .single();

      if (error || !business) return;

      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           ✅ SUBSCRIPTION RENEWED                         ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Plan: ${renewalData.planName.padEnd(51)}║
║ Next billing: ${new Date(renewalData.nextBillingDate).toLocaleDateString()}${' '.repeat(43 - new Date(renewalData.nextBillingDate).toLocaleDateString().length)}║
║                                                           ║
║ Thank you for continuing with BizReply AI!               ║
╚═══════════════════════════════════════════════════════════╝
      `);

      await this.logNotification(businessId, {
        type: 'renewal_success',
        channel: 'console',
        recipient: business.contact_email,
        data: renewalData,
        status: 'sent'
      });
    } catch (error) {
      logger.error('Error sending renewal success notification:', error);
    }
  }

  /**
   * Send subscription cancelled notification
   */
  async sendSubscriptionCancelledNotification(businessId, cancellationData) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('business_name, contact_email')
        .eq('id', businessId)
        .single();

      if (error || !business) return;

      logger.info(`
╔═══════════════════════════════════════════════════════════╗
║           ⚠️  SUBSCRIPTION CANCELLED                      ║
╠═══════════════════════════════════════════════════════════╣
║ Business: ${business.business_name.padEnd(47)}║
║ Previous Plan: ${cancellationData.planName.padEnd(42)}║
║                                                           ║
║ Your subscription has been cancelled and downgraded      ║
║ to the Free plan. You can upgrade anytime to restore     ║
║ full features.                                           ║
║                                                           ║
║ 🔄 Reactivate: https://bizreply.ai/billing              ║
╚═══════════════════════════════════════════════════════════╝
      `);

      await this.logNotification(businessId, {
        type: 'subscription_cancelled',
        channel: 'console',
        recipient: business.contact_email,
        data: cancellationData,
        status: 'sent'
      });
    } catch (error) {
      logger.error('Error sending cancellation notification:', error);
    }
  }

  /**
   * Generate HTML email for usage limit alert
   */
  generateLimitEmailHTML(business, alertData) {
    const { usage, limit, percentage, plan } = alertData;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .stats { background: white; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .cta-button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 Usage Limit Alert</h1>
    </div>
    <div class="content">
      <h2>Hi ${business.business_name},</h2>
      
      <div class="alert-box">
        <strong>Your AI assistant has reached its monthly message limit.</strong>
      </div>
      
      <div class="stats">
        <p><strong>Current Plan:</strong> ${plan}</p>
        <p><strong>Usage:</strong> ${usage} / ${limit} messages (${percentage}%)</p>
      </div>
      
      <h3>What happens now?</h3>
      <p>Don't worry - your customers can still reach you! Here's what's changed:</p>
      <ul>
        <li>✅ Customers will receive a friendly response with your contact information</li>
        <li>✅ All messages are still saved in your dashboard</li>
        <li>✅ You can reply manually through WhatsApp or the admin panel</li>
        <li>❌ AI-powered responses are paused until you upgrade</li>
      </ul>
      
      <h3>Ready to resume AI responses?</h3>
      <p>Upgrade your plan to get more messages and unlock advanced features:</p>
      
      <a href="https://bizreply.ai/billing?businessId=${business.id}" class="cta-button">
        Upgrade Now
      </a>
      
      <p>Questions? Reply to this email or contact our support team.</p>
      
      <div class="footer">
        <p>BizReply AI - Smart WhatsApp Automation for Your Business</p>
        <p>You're receiving this because you own ${business.business_name}</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }
}

export default new NotificationService();
