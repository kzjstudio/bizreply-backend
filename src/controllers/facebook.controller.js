import { sendFacebookMessage, replyToFacebookComment, sendTypingIndicator } from '../services/facebook.service.js';
import { generateAIResponse } from '../services/ai.service.js';
import { saveMessage, getBusinessByPageId } from '../services/database.service.js';
import { logger } from '../utils/logger.js';

/**
 * Verify Facebook/Instagram webhook (GET request from Meta)
 * This is the same verification process for both Facebook and Instagram
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info('✅ Facebook webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.error('❌ Facebook webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    logger.error('❌ Missing Facebook webhook verification parameters');
    res.sendStatus(400);
  }
};

/**
 * Handle incoming Facebook Messenger messages and page events (POST request from Meta)
 */
export const handleWebhook = async (req, res) => {
  // Respond quickly to Meta to avoid timeout
  res.sendStatus(200);

  try {
    const body = req.body;

    // Check if this is a page subscription event
    if (body.object === 'page') {
      // Process each entry
      for (const entry of body.entry) {
        const pageId = entry.id;
        
        // Handle messaging events (Facebook Messenger)
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await handleMessagingEvent(messagingEvent, pageId);
          }
        }

        // Handle feed/comment events (Facebook Page comments)
        if (entry.changes) {
          for (const change of entry.changes) {
            await handleFeedChange(change, pageId);
          }
        }
      }
    }
  } catch (error) {
    logger.error('❌ Error processing Facebook webhook:', error);
  }
};

/**
 * Handle Facebook Messenger messaging events
 */
const handleMessagingEvent = async (event, pageId) => {
  const senderId = event.sender.id;
  const recipientId = event.recipient.id;
  const timestamp = event.timestamp;

  // Handle incoming messages
  if (event.message && !event.message.is_echo) {
    const message = event.message;
    const messageId = message.mid;
    const messageText = message.text;

    logger.info(`📩 New Facebook message from ${senderId}: ${messageText}`);

    // Only process text messages for now
    if (messageText) {
      await processFacebookMessage({
        senderId,
        pageId,
        messageId,
        messageText,
        timestamp: new Date(timestamp)
      });
    } else if (message.attachments) {
      logger.info(`⚠️ Received Facebook attachment from ${senderId}, type: ${message.attachments[0].type}`);
    }
  }

  // Handle message delivery confirmations
  if (event.delivery) {
    logger.info(`📬 Facebook message delivered to ${senderId}`);
  }

  // Handle message read confirmations
  if (event.read) {
    logger.info(`👀 Facebook message read by ${senderId}`);
  }

  // Handle postbacks (button clicks)
  if (event.postback) {
    logger.info(`🔘 Facebook postback from ${senderId}: ${event.postback.payload}`);
  }
};

/**
 * Handle Facebook Page feed changes (comments on posts)
 */
const handleFeedChange = async (change, pageId) => {
  if (change.field === 'feed') {
    const value = change.value;
    
    // Handle new comments
    if (value.item === 'comment' && value.verb === 'add') {
      const commentId = value.comment_id;
      const postId = value.post_id;
      const senderId = value.from?.id;
      const senderName = value.from?.name;
      const commentText = value.message;
      const parentId = value.parent_id;

      // Don't reply to our own comments
      if (senderId === pageId) {
        logger.info('⏭️ Skipping own comment');
        return;
      }

      logger.info(`💬 New Facebook comment from ${senderName}: ${commentText}`);

      await processFacebookComment({
        commentId,
        postId,
        pageId,
        senderId,
        senderName,
        commentText,
        parentId,
        timestamp: new Date(value.created_time * 1000)
      });
    }
  }
};

/**
 * Process incoming Facebook Messenger message and generate AI response
 */
const processFacebookMessage = async ({ senderId, pageId, messageId, messageText, timestamp }) => {
  try {
    // Get business information based on the page ID
    const business = await getBusinessByPageId(pageId);
    
    if (!business) {
      logger.error(`❌ No business found for Facebook page ID: ${pageId}`);
      return;
    }

    const pageAccessToken = business.facebookPageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      logger.error('❌ No Facebook page access token found');
      return;
    }

    // Save incoming message to database
    await saveMessage({
      messageId,
      businessId: business.id,
      from: senderId,
      to: pageId,
      messageText,
      timestamp,
      direction: 'incoming',
      type: 'text',
      platform: 'facebook'
    });

    // Send typing indicator
    await sendTypingIndicator({
      recipientId: senderId,
      pageAccessToken
    });

    // Generate AI response
    const aiResponse = await generateAIResponse({
      customerMessage: messageText,
      customerPhone: senderId,
      businessId: business.id,
      businessRules: business.rules,
      templates: business.templates
    });

    // Send reply back to customer
    const sentMessage = await sendFacebookMessage({
      recipientId: senderId,
      message: aiResponse,
      pageAccessToken
    });

    // Save outgoing message to database
    if (sentMessage) {
      await saveMessage({
        messageId: sentMessage.messageId,
        businessId: business.id,
        from: pageId,
        to: senderId,
        messageText: aiResponse,
        timestamp: new Date(),
        direction: 'outgoing',
        type: 'text',
        platform: 'facebook'
      });
    }

    logger.info(`✅ Replied to Facebook user ${senderId} successfully`);
  } catch (error) {
    logger.error('❌ Error processing Facebook message:', error);
  }
};

/**
 * Process incoming Facebook comment and generate AI response
 */
const processFacebookComment = async ({ commentId, postId, pageId, senderId, senderName, commentText, parentId, timestamp }) => {
  try {
    // Get business information based on the page ID
    const business = await getBusinessByPageId(pageId);
    
    if (!business) {
      logger.error(`❌ No business found for Facebook page ID: ${pageId}`);
      return;
    }

    // Check if auto-reply to comments is enabled
    if (!business.settings?.autoReplyComments) {
      logger.info('⏭️ Auto-reply to Facebook comments is disabled for this business');
      return;
    }

    const pageAccessToken = business.facebookPageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      logger.error('❌ No Facebook page access token found');
      return;
    }

    // Save incoming comment to database
    await saveMessage({
      messageId: commentId,
      businessId: business.id,
      from: senderId,
      fromName: senderName,
      to: pageId,
      messageText: commentText,
      postId,
      parentId,
      timestamp,
      direction: 'incoming',
      type: 'comment',
      platform: 'facebook'
    });

    // Generate AI response for comment
    const aiResponse = await generateAIResponse({
      customerMessage: commentText,
      customerPhone: senderId,
      businessId: business.id,
      businessRules: business.rules,
      templates: business.templates
    });

    // Personalize the response with the user's name
    const personalizedResponse = senderName 
      ? `${senderName}, ${aiResponse.charAt(0).toLowerCase()}${aiResponse.slice(1)}`
      : aiResponse;

    // Reply to the comment
    const sentComment = await replyToFacebookComment({
      commentId,
      message: personalizedResponse,
      pageAccessToken
    });

    // Save outgoing comment reply to database
    if (sentComment) {
      await saveMessage({
        messageId: sentComment.commentId,
        businessId: business.id,
        from: pageId,
        to: senderId,
        messageText: personalizedResponse,
        postId,
        parentId: commentId,
        timestamp: new Date(),
        direction: 'outgoing',
        type: 'comment',
        platform: 'facebook'
      });
    }

    logger.info(`✅ Replied to Facebook comment from ${senderName} successfully`);
  } catch (error) {
    logger.error('❌ Error processing Facebook comment:', error);
  }
};
