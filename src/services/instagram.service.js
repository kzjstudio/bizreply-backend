import axios from 'axios';
import { logger } from '../utils/logger.js';

const INSTAGRAM_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a text message via Instagram Messaging API
 * Instagram uses the same Graph API as Facebook but with different endpoints
 */
export const sendInstagramMessage = async ({ recipientId, message, instagramAccountId, pageAccessToken }) => {
  try {
    const url = `${INSTAGRAM_GRAPH_API_URL}/${instagramAccountId}/messages`;
    
    const data = {
      recipient: {
        id: recipientId
      },
      message: {
        text: message
      }
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Instagram message sent to ${recipientId}`);
    return {
      success: true,
      messageId: response.data.message_id,
      recipientId: response.data.recipient_id,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error sending Instagram message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Reply to an Instagram comment on a media post
 */
export const replyToInstagramComment = async ({ commentId, message, pageAccessToken }) => {
  try {
    const url = `${INSTAGRAM_GRAPH_API_URL}/${commentId}/replies`;
    
    const data = {
      message: message
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Reply posted to Instagram comment ${commentId}`);
    return {
      success: true,
      commentId: response.data.id,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error replying to Instagram comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get Instagram comment details
 */
export const getInstagramComment = async ({ commentId, pageAccessToken }) => {
  try {
    const url = `${INSTAGRAM_GRAPH_API_URL}/${commentId}`;

    const response = await axios.get(url, {
      params: {
        fields: 'id,text,timestamp,username,from'
      },
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    logger.error('❌ Error getting Instagram comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get Instagram media details (to understand context of comments)
 */
export const getInstagramMedia = async ({ mediaId, pageAccessToken }) => {
  try {
    const url = `${INSTAGRAM_GRAPH_API_URL}/${mediaId}`;

    const response = await axios.get(url, {
      params: {
        fields: 'id,caption,media_type,timestamp,permalink'
      },
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    logger.error('❌ Error getting Instagram media:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Delete an Instagram comment (for moderation)
 */
export const deleteInstagramComment = async ({ commentId, pageAccessToken }) => {
  try {
    const url = `${INSTAGRAM_GRAPH_API_URL}/${commentId}`;

    const response = await axios.delete(url, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Instagram comment ${commentId} deleted`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error deleting Instagram comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Hide an Instagram comment (less aggressive than delete)
 */
export const hideInstagramComment = async ({ commentId, pageAccessToken, hide = true }) => {
  try {
    const url = `${INSTAGRAM_GRAPH_API_URL}/${commentId}`;

    const response = await axios.post(url, { hide }, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Instagram comment ${commentId} ${hide ? 'hidden' : 'unhidden'}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error hiding Instagram comment:', error.response?.data || error.message);
    throw error;
  }
};
