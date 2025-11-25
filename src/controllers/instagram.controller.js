import { sendInstagramMessage, replyToInstagramComment } from '../services/instagram.service.js';
import { generateAIResponse } from '../services/ai.service.js';
import { saveMessage, getBusinessByInstagramId } from '../services/database.service.js';
import { logger } from '../utils/logger.js';

/**
 * Verify Instagram webhook (GET request from Meta)
 * Instagram uses the same verification process as Facebook
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      logger.info('✅ Instagram webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.error('❌ Instagram webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    logger.error('❌ Missing Instagram webhook verification parameters');
    res.sendStatus(400);
  }
};

/**
 * Handle incoming Instagram events (POST request from Meta)
 */
export const handleWebhook = async (req, res) => {
  // Respond quickly to Meta to avoid timeout
  res.sendStatus(200);

  try {
    const body = req.body;

    // Check if this is an Instagram subscription event
    if (body.object === 'instagram') {
      // Process each entry
      for (const entry of body.entry) {
        const instagramAccountId = entry.id;
        
        // Handle messaging events (Instagram Direct)
        if (entry.messaging) {
          for (const messagingEvent of entry.messaging) {
            await handleMessagingEvent(messagingEvent, instagramAccountId);
          }
        }

        // Handle comment events (Instagram comments on posts)
        if (entry.changes) {
          for (const change of entry.changes) {
            await handleInstagramChange(change, instagramAccountId);
          }
        }
      }
    }
  } catch (error) {
    logger.error('❌ Error processing Instagram webhook:', error);
  }
};

/**
 * Handle Instagram Direct messaging events
 */
const handleMessagingEvent = async (event, instagramAccountId) => {
  const senderId = event.sender.id;
  const recipientId = event.recipient.id;
  const timestamp = event.timestamp;

  // Handle incoming messages
  if (event.message && !event.message.is_echo) {
    const message = event.message;
    const messageId = message.mid;
    const messageText = message.text;

    logger.info(`📩 New Instagram message from ${senderId}: ${messageText}`);

    // Only process text messages for now
    if (messageText) {
      await processInstagramMessage({
        senderId,
        instagramAccountId,
        messageId,
        messageText,
        timestamp: new Date(timestamp)
      });
    } else if (message.attachments) {
      logger.info(`⚠️ Received Instagram attachment from ${senderId}, type: ${message.attachments[0].type}`);
    }
  }

  // Handle message reactions
  if (event.reaction) {
    logger.info(`❤️ Instagram reaction from ${senderId}: ${event.reaction.reaction}`);
  }

  // Handle story mentions
  if (event.message?.attachments?.[0]?.type === 'story_mention') {
    logger.info(`📖 Instagram story mention from ${senderId}`);
  }

  // Handle story replies
  if (event.message?.reply_to?.story) {
    logger.info(`📖 Instagram story reply from ${senderId}`);
  }
};

/**
 * Handle Instagram account changes (comments, mentions, etc.)
 */
const handleInstagramChange = async (change, instagramAccountId) => {
  // Handle comments on posts
  if (change.field === 'comments') {
    const value = change.value;
    const commentId = value.id;
    const mediaId = value.media?.id;
    const senderId = value.from?.id;
    const senderUsername = value.from?.username;
    const commentText = value.text;

    // Don't reply to our own comments
    if (senderId === instagramAccountId) {
      logger.info('⏭️ Skipping own Instagram comment');
      return;
    }

    logger.info(`💬 New Instagram comment from @${senderUsername}: ${commentText}`);

    await processInstagramComment({
      commentId,
      mediaId,
      instagramAccountId,
      senderId,
      senderUsername,
      commentText,
      timestamp: new Date()
    });
  }

  // Handle mentions in captions
  if (change.field === 'mentions') {
    const value = change.value;
    logger.info(`📢 Instagram mention from ${value.from?.username}`);
    // Could trigger a DM response or track for analytics
  }
};

/**
 * Process incoming Instagram Direct message and generate AI response
 */
const processInstagramMessage = async ({ senderId, instagramAccountId, messageId, messageText, timestamp }) => {
  try {
    // Get business information based on the Instagram account ID
    const business = await getBusinessByInstagramId(instagramAccountId);
    
    if (!business) {
      logger.error(`❌ No business found for Instagram account ID: ${instagramAccountId}`);
      return;
    }

    const pageAccessToken = business.facebookPageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      logger.error('❌ No page access token found for Instagram messaging');
      return;
    }

    // Save incoming message to database
    await saveMessage({
      messageId,
      businessId: business.id,
      from: senderId,
      to: instagramAccountId,
      messageText,
      timestamp,
      direction: 'incoming',
      type: 'text',
      platform: 'instagram'
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
    const sentMessage = await sendInstagramMessage({
      recipientId: senderId,
      message: aiResponse,
      instagramAccountId,
      pageAccessToken
    });

    // Save outgoing message to database
    if (sentMessage) {
      await saveMessage({
        messageId: sentMessage.messageId,
        businessId: business.id,
        from: instagramAccountId,
        to: senderId,
        messageText: aiResponse,
        timestamp: new Date(),
        direction: 'outgoing',
        type: 'text',
        platform: 'instagram'
      });
    }

    logger.info(`✅ Replied to Instagram user ${senderId} successfully`);
  } catch (error) {
    logger.error('❌ Error processing Instagram message:', error);
  }
};

/**
 * Process incoming Instagram comment and generate AI response
 */
const processInstagramComment = async ({ commentId, mediaId, instagramAccountId, senderId, senderUsername, commentText, timestamp }) => {
  try {
    // Get business information based on the Instagram account ID
    const business = await getBusinessByInstagramId(instagramAccountId);
    
    if (!business) {
      logger.error(`❌ No business found for Instagram account ID: ${instagramAccountId}`);
      return;
    }

    // Check if auto-reply to comments is enabled
    if (!business.settings?.autoReplyComments) {
      logger.info('⏭️ Auto-reply to Instagram comments is disabled for this business');
      return;
    }

    const pageAccessToken = business.facebookPageAccessToken || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;

    if (!pageAccessToken) {
      logger.error('❌ No page access token found for Instagram comments');
      return;
    }

    // Save incoming comment to database
    await saveMessage({
      messageId: commentId,
      businessId: business.id,
      from: senderId,
      fromUsername: senderUsername,
      to: instagramAccountId,
      messageText: commentText,
      mediaId,
      timestamp,
      direction: 'incoming',
      type: 'comment',
      platform: 'instagram'
    });

    // Generate AI response for comment
    const aiResponse = await generateAIResponse({
      customerMessage: commentText,
      customerPhone: senderId,
      businessId: business.id,
      businessRules: business.rules,
      templates: business.templates
    });

    // Personalize the response with the user's username
    const personalizedResponse = senderUsername 
      ? `@${senderUsername} ${aiResponse}`
      : aiResponse;

    // Reply to the comment
    const sentComment = await replyToInstagramComment({
      commentId,
      message: personalizedResponse,
      pageAccessToken
    });

    // Save outgoing comment reply to database
    if (sentComment) {
      await saveMessage({
        messageId: sentComment.commentId,
        businessId: business.id,
        from: instagramAccountId,
        to: senderId,
        messageText: personalizedResponse,
        mediaId,
        parentCommentId: commentId,
        timestamp: new Date(),
        direction: 'outgoing',
        type: 'comment',
        platform: 'instagram'
      });
    }

    logger.info(`✅ Replied to Instagram comment from @${senderUsername} successfully`);
  } catch (error) {
    logger.error('❌ Error processing Instagram comment:', error);
  }
};
