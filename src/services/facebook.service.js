import axios from 'axios';
import { logger } from '../utils/logger.js';

const FACEBOOK_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

/**
 * Send a text message via Facebook Messenger API
 */
export const sendFacebookMessage = async ({ recipientId, message, pageAccessToken }) => {
  try {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/messages`;
    
    const data = {
      recipient: {
        id: recipientId
      },
      message: {
        text: message
      },
      messaging_type: 'RESPONSE'
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Facebook message sent to ${recipientId}`);
    return {
      success: true,
      messageId: response.data.message_id,
      recipientId: response.data.recipient_id,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error sending Facebook message:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Reply to a Facebook comment
 */
export const replyToFacebookComment = async ({ commentId, message, pageAccessToken }) => {
  try {
    const url = `${FACEBOOK_GRAPH_API_URL}/${commentId}/comments`;
    
    const data = {
      message: message
    };

    const response = await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Reply posted to Facebook comment ${commentId}`);
    return {
      success: true,
      commentId: response.data.id,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error replying to Facebook comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Like a Facebook comment (optional engagement)
 */
export const likeFacebookComment = async ({ commentId, pageAccessToken }) => {
  try {
    const url = `${FACEBOOK_GRAPH_API_URL}/${commentId}/likes`;

    const response = await axios.post(url, {}, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Liked Facebook comment ${commentId}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    logger.error('❌ Error liking Facebook comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Get Facebook comment details
 */
export const getFacebookComment = async ({ commentId, pageAccessToken }) => {
  try {
    const url = `${FACEBOOK_GRAPH_API_URL}/${commentId}`;

    const response = await axios.get(url, {
      params: {
        fields: 'id,message,from,created_time,parent'
      },
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    logger.error('❌ Error getting Facebook comment:', error.response?.data || error.message);
    throw error;
  }
};

/**
 * Send typing indicator to user in Messenger
 */
export const sendTypingIndicator = async ({ recipientId, pageAccessToken, action = 'typing_on' }) => {
  try {
    const url = `${FACEBOOK_GRAPH_API_URL}/me/messages`;
    
    const data = {
      recipient: {
        id: recipientId
      },
      sender_action: action // 'typing_on', 'typing_off', or 'mark_seen'
    };

    await axios.post(url, data, {
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    logger.info(`✅ Typing indicator sent to ${recipientId}`);
  } catch (error) {
    logger.error('❌ Error sending typing indicator:', error.response?.data || error.message);
  }
};

/**
 * Get user profile information from Facebook
 */
export const getFacebookUserProfile = async ({ userId, pageAccessToken }) => {
  try {
    const url = `${FACEBOOK_GRAPH_API_URL}/${userId}`;

    const response = await axios.get(url, {
      params: {
        fields: 'first_name,last_name,profile_pic'
      },
      headers: {
        'Authorization': `Bearer ${pageAccessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    logger.error('❌ Error getting Facebook user profile:', error.response?.data || error.message);
    return null;
  }
};
