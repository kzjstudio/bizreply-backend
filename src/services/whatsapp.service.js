import axios from 'axios';
import { logger } from '../utils/logger.js';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a text message via WhatsApp Business API
 */
export const sendWhatsAppMessage = async ({ to, message, phoneNumberId }) => {
  try {
    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;
    
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
        'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Message sent to ${to}`);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send a template message
 */
export const sendTemplateMessage = async ({ to, templateName, languageCode = 'en', components, phoneNumberId }) => {
  try {
    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;
    
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
        'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Template message sent to ${to}`);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error sending template message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Mark a message as read
 */
export const markMessageAsRead = async ({ messageId, phoneNumberId }) => {
  try {
    const url = `${WHATSAPP_API_URL}/${phoneNumberId}/messages`;
    
    const data = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId
    };

    await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Message ${messageId} marked as read`);
  } catch (error) {
    logger.error('❌ Error marking message as read:', error.response?.data || error.message);
  }
};
