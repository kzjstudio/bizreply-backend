import axios from 'axios';
import { logger } from '../src/utils/logger.js';

/**
 * Fygaro Payment Gateway Service
 * Caribbean-focused payment processing for Barbados and region
 * 
 * API Documentation: https://docs.fygaro.com
 */
class FygaroService {
  constructor() {
    this.apiKey = process.env.FYGARO_API_KEY;
    this.secretKey = process.env.FYGARO_SECRET_KEY;
    this.webhookSecret = process.env.FYGARO_WEBHOOK_SECRET;
    this.baseUrl = process.env.FYGARO_API_URL || 'https://api.fygaro.com/v1';
    this.currency = process.env.FYGARO_CURRENCY || 'BBD'; // Barbados Dollar
    
    // Initialize axios instance with auth
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey
      },
      timeout: 30000 // 30 second timeout
    });
  }

  /**
   * Check if Fygaro is configured
   */
  isConfigured() {
    return !!(this.apiKey && this.secretKey);
  }

  /**
   * Create a customer in Fygaro
   */
  async createCustomer({ email, name, phone, businessId, metadata = {} }) {
    try {
      if (!this.isConfigured()) {
        logger.warn('Fygaro not configured, skipping customer creation');
        return { success: false, error: 'Fygaro not configured' };
      }

      logger.info(`Creating Fygaro customer: ${email}`);

      const response = await this.client.post('/customers', {
        email,
        name,
        phone,
        metadata: {
          business_id: businessId,
          source: 'bizreply_ai',
          ...metadata
        }
      });

      logger.info(`✅ Fygaro customer created: ${response.data.id}`);

      return {
        success: true,
        customerId: response.data.id,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creating Fygaro customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId) {
    try {
      const response = await this.client.get(`/customers/${customerId}`);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error fetching Fygaro customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Add payment method to customer
   */
  async addPaymentMethod(customerId, { cardToken, cardDetails }) {
    try {
      logger.info(`Adding payment method for customer: ${customerId}`);

      const response = await this.client.post('/payment_methods', {
        customer: customerId,
        type: 'card',
        card: cardDetails || { token: cardToken }
      });

      logger.info(`✅ Payment method added: ${response.data.id}`);

      return {
        success: true,
        paymentMethodId: response.data.id,
        data: response.data
      };
    } catch (error) {
      logger.error('Error adding payment method:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Create a subscription
   */
  async createSubscription({
    customerId,
    priceId,
    planName,
    amount,
    interval, // 'month' or 'year'
    metadata = {}
  }) {
    try {
      if (!this.isConfigured()) {
        logger.warn('Fygaro not configured, skipping subscription creation');
        return { success: false, error: 'Fygaro not configured' };
      }

      logger.info(`Creating Fygaro subscription for customer: ${customerId}`);

      const response = await this.client.post('/subscriptions', {
        customer: customerId,
        items: [{
          price: priceId || 'default',
          plan: planName,
          amount: Math.round(amount * 100), // Convert to cents
          currency: this.currency,
          interval: interval,
          interval_count: 1
        }],
        metadata: {
          source: 'bizreply_ai',
          ...metadata
        }
      });

      logger.info(`✅ Fygaro subscription created: ${response.data.id}`);

      return {
        success: true,
        subscriptionId: response.data.id,
        status: response.data.status,
        currentPeriodEnd: response.data.current_period_end,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creating Fygaro subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId, { cancelAtPeriodEnd = true } = {}) {
    try {
      logger.info(`Cancelling Fygaro subscription: ${subscriptionId}`);

      const endpoint = cancelAtPeriodEnd 
        ? `/subscriptions/${subscriptionId}`
        : `/subscriptions/${subscriptionId}/cancel`;

      const response = await this.client.post(endpoint, {
        cancel_at_period_end: cancelAtPeriodEnd
      });

      logger.info(`✅ Fygaro subscription cancelled: ${subscriptionId}`);

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      logger.error('Error cancelling Fygaro subscription:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Charge a customer (one-time payment)
   */
  async chargeCustomer({
    customerId,
    amount,
    description,
    metadata = {}
  }) {
    try {
      if (!this.isConfigured()) {
        logger.warn('Fygaro not configured, skipping charge');
        return { success: false, error: 'Fygaro not configured' };
      }

      logger.info(`Charging customer ${customerId}: ${this.currency} ${amount}`);

      const response = await this.client.post('/charges', {
        customer: customerId,
        amount: Math.round(amount * 100), // Convert to cents
        currency: this.currency,
        description,
        metadata: {
          source: 'bizreply_ai',
          ...metadata
        }
      });

      logger.info(`✅ Charge successful: ${response.data.id}`);

      return {
        success: true,
        chargeId: response.data.id,
        status: response.data.status,
        paid: response.data.paid,
        data: response.data
      };
    } catch (error) {
      logger.error('Error charging customer:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
        declineCode: error.response?.data?.decline_code
      };
    }
  }

  /**
   * Charge subscription renewal
   */
  async chargeSubscription(subscription) {
    try {
      const { business_id, fygaro_customer_id, plan, billing_cycle } = subscription;

      if (!fygaro_customer_id) {
        throw new Error('Customer does not have a Fygaro customer ID');
      }

      const amount = billing_cycle === 'yearly' ? plan.price_yearly : plan.price_monthly;
      const description = `${plan.name} - ${billing_cycle === 'yearly' ? 'Annual' : 'Monthly'} Subscription Renewal`;

      const result = await this.chargeCustomer({
        customerId: fygaro_customer_id,
        amount,
        description,
        metadata: {
          business_id,
          subscription_id: subscription.id,
          plan_id: plan.id,
          plan_name: plan.name,
          billing_cycle
        }
      });

      return result;
    } catch (error) {
      logger.error('Error charging subscription:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Create invoice
   */
  async createInvoice({
    customerId,
    subscriptionId,
    amount,
    description,
    dueDate,
    metadata = {}
  }) {
    try {
      logger.info(`Creating Fygaro invoice for customer: ${customerId}`);

      const response = await this.client.post('/invoices', {
        customer: customerId,
        subscription: subscriptionId,
        amount: Math.round(amount * 100),
        currency: this.currency,
        description,
        due_date: dueDate,
        metadata: {
          source: 'bizreply_ai',
          ...metadata
        }
      });

      logger.info(`✅ Fygaro invoice created: ${response.data.id}`);

      return {
        success: true,
        invoiceId: response.data.id,
        invoiceUrl: response.data.invoice_url,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creating Fygaro invoice:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Refund a charge
   */
  async refundCharge(chargeId, { amount = null, reason = '' } = {}) {
    try {
      logger.info(`Refunding charge: ${chargeId}`);

      const payload = { charge: chargeId };
      if (amount) payload.amount = Math.round(amount * 100);
      if (reason) payload.reason = reason;

      const response = await this.client.post('/refunds', payload);

      logger.info(`✅ Refund successful: ${response.data.id}`);

      return {
        success: true,
        refundId: response.data.id,
        data: response.data
      };
    } catch (error) {
      logger.error('Error creating refund:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message
      };
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    try {
      if (!this.webhookSecret) {
        logger.warn('Webhook secret not configured, skipping verification');
        return true; // Fail open for development
      }

      // Implementation depends on Fygaro's signing method
      // Typically HMAC SHA256
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      return signature === expectedSignature;
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Handle webhook event
   */
  async handleWebhook(event) {
    try {
      const { type, data } = event;

      logger.info(`📨 Fygaro webhook received: ${type}`);

      switch (type) {
        case 'charge.succeeded':
          return await this.handleChargeSucceeded(data.object);
        
        case 'charge.failed':
          return await this.handleChargeFailed(data.object);
        
        case 'subscription.created':
          return await this.handleSubscriptionCreated(data.object);
        
        case 'subscription.updated':
          return await this.handleSubscriptionUpdated(data.object);
        
        case 'subscription.deleted':
          return await this.handleSubscriptionDeleted(data.object);
        
        case 'invoice.payment_succeeded':
          return await this.handleInvoicePaymentSucceeded(data.object);
        
        case 'invoice.payment_failed':
          return await this.handleInvoicePaymentFailed(data.object);
        
        default:
          logger.info(`Unhandled webhook type: ${type}`);
          return { received: true };
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  // Webhook handlers (to be implemented with database updates)
  async handleChargeSucceeded(charge) {
    logger.info(`✅ Charge succeeded: ${charge.id}`);
    return { received: true };
  }

  async handleChargeFailed(charge) {
    logger.error(`❌ Charge failed: ${charge.id}`);
    return { received: true };
  }

  async handleSubscriptionCreated(subscription) {
    logger.info(`✅ Subscription created: ${subscription.id}`);
    return { received: true };
  }

  async handleSubscriptionUpdated(subscription) {
    logger.info(`🔄 Subscription updated: ${subscription.id}`);
    return { received: true };
  }

  async handleSubscriptionDeleted(subscription) {
    logger.info(`❌ Subscription deleted: ${subscription.id}`);
    return { received: true };
  }

  async handleInvoicePaymentSucceeded(invoice) {
    logger.info(`✅ Invoice payment succeeded: ${invoice.id}`);
    return { received: true };
  }

  async handleInvoicePaymentFailed(invoice) {
    logger.error(`❌ Invoice payment failed: ${invoice.id}`);
    return { received: true };
  }
}

export default new FygaroService();
