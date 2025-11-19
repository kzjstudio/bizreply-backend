import axios from 'axios';
import twilio from 'twilio';
import { logger } from '../utils/logger.js';

// Configuration
const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'meta'; // 'meta' or 'twilio'

// Meta credentials
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;

// Twilio credentials
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;

// Initialize Twilio client
let twilioClient;
if (WHATSAPP_PROVIDER === 'twilio' && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  logger.info('Twilio WhatsApp client initialized');
}

/**
 * Send a text message via Twilio
 */
const sendWhatsAppMessageViaTwilio = async ({ to, message }) => {
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: `whatsapp:`,
      to: `whatsapp:`
    });
    
    logger.info(` Twilio message sent to , SID: `);
    return {
      success: true,
      messageId: result.sid,
      provider: 'twilio',
      data: result
    };
  } catch (error) {
    logger.error(' Error sending Twilio WhatsApp message:', error.message);
    throw error;
  }
};

/**
 * Send a text message via Meta Graph API
 */
const sendWhatsAppMessageViaMeta = async ({ to, message, phoneNumberId }) => {
  try {
    const url = `//messages`;

    const data = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to,
      type: 'text',
      text: {
        preview_url: false,
        body: message
      }
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer `,
        'Content-Type': 'application/json'
      }
    });

    logger.info(` Meta message sent to `);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      provider: 'meta',
      data: response.data
    };
  } catch (error) {
    logger.error(' Error sending Meta WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send a text message via WhatsApp (auto-selects provider)
 */
export const sendWhatsAppMessage = async ({ to, message, phoneNumberId }) => {
  // Remove 'whatsapp:' prefix if present
  const cleanNumber = to.replace('whatsapp:', '');
  
  if (WHATSAPP_PROVIDER === 'twilio') {
    return await sendWhatsAppMessageViaTwilio({ to: cleanNumber, message });
  } else {
    return await sendWhatsAppMessageViaMeta({ to: cleanNumber, message, phoneNumberId });
  }
};

/**
 * Send a template message (Meta only)
 */
export const sendTemplateMessage = async ({ to, templateName, languageCode = 'en', components, phoneNumberId }) => {
  if (WHATSAPP_PROVIDER === 'twilio') {
    logger.warn('Template messages not supported with Twilio provider');
    return { success: false, error: 'Template messages not supported with Twilio' };
  }

  try {
    const url = `//messages`;

    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode
        },
        components: components || []
      }
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer `,
        'Content-Type': 'application/json'
      }
    });

    logger.info(` Template message sent to `);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    logger.error(' Error sending template message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Mark a message as read (Meta only)
 */
export const markMessageAsRead = async ({ messageId, phoneNumberId }) => {
  if (WHATSAPP_PROVIDER === 'twilio') {
    // Twilio doesn't have mark as read functionality
    return;
  }

  try {
    const url = `//messages`;

    const data = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer `,
        'Content-Type': 'application/json'
      }
    });

    logger.info(` Message  marked as read`);
  } catch (error) {
    logger.error(' Error marking message as read:', error.response?.data || error.message);
  }
};

/**
 * Parse incoming Twilio webhook
 */
export const parseTwilioWebhook = (body) => {
  return {
    from: body.From.replace('whatsapp:', ''),
    to: body.To.replace('whatsapp:', ''),
    message: body.Body,
    messageId: body.MessageSid,
    timestamp: new Date().toISOString(),
    provider: 'twilio'
  };
};

/**
 * Parse incoming Meta webhook
 */
export const parseMetaWebhook = (body) => {
  const entry = body.entry[0];
  const changes = entry.changes[0];
  const value = changes.value;
  const message = value.messages[0];
  
  return {
    from: message.from,
    to: value.metadata.phone_number_id,
    message: message.text.body,
    messageId: message.id,
    timestamp: new Date(message.timestamp * 1000).toISOString(),
    provider: 'meta'
  };
};
