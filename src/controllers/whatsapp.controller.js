import { sendWhatsAppMessage, parseTwilioWebhook, parseMetaWebhook } from '../services/whatsapp.service.js';
import { generateAIResponse } from '../services/ai.service.js';
import { saveMessage, getBusinessByPhone } from '../services/database.service.js';
import { logger } from '../utils/logger.js';

const WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER || 'meta';

/**
 * Verify WhatsApp webhook (GET request from Meta)
 */
export const verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      // Respond with 200 OK and challenge token from the request
      logger.info(' Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      logger.error(' Webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    logger.error(' Missing webhook verification parameters');
    res.sendStatus(400);
  }
};

/**
 * Handle incoming WhatsApp messages (POST request from Meta or Twilio)
 */
export const handleWebhook = async (req, res) => {
  // Respond quickly to avoid timeout
  res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

  try {
    const body = req.body;
    
    logger.info(' Webhook received:', JSON.stringify(body, null, 2));
    logger.info(' Webhook type check - MessageSid:', body.MessageSid, 'Body:', body.Body, 'SmsStatus:', body.SmsStatus);

    // Detect provider based on webhook structure
    let parsedMessage;
    let phoneNumberId;
    
    if (body.MessageSid && body.Body) {
      // Twilio incoming message webhook (ignore status callbacks)
      logger.info(' Detected Twilio webhook');
      parsedMessage = parseTwilioWebhook(body);
      phoneNumberId = process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886'; // Twilio sandbox number
    } else if (body.object === 'whatsapp_business_account') {
      // Meta webhook
      logger.info(' Detected Meta webhook');
      await handleMetaWebhook(body);
      return;
    } else {
      logger.warn(' Unknown webhook format');
      return;
    }

    // Handle Twilio webhook
    if (parsedMessage) {
      await processTwilioMessage(parsedMessage, phoneNumberId);
    }

  } catch (error) {
    logger.error(' Error processing webhook:', error);
  }
};

/**
 * Process Twilio message
 */
async function processTwilioMessage(parsedMessage, phoneNumberId) {
  const { from, message, messageId, timestamp } = parsedMessage;

  logger.info(` Message from ${from}: ${message}`);

  // Get business information by Twilio phone number
  const business = await getBusinessByPhone(phoneNumberId);
  
  if (!business) {
    logger.error(` No business found for phone number ID: ${phoneNumberId}`);
    // For testing, use a default business ID
    const defaultBusinessId = 'default';
    
    // Save incoming message
    await saveMessage({
      messageId,
      businessId: defaultBusinessId,
      from,
      to: phoneNumberId,
      messageText: message,
      timestamp: new Date(timestamp),
      direction: 'incoming',
      type: 'text'
    });

    // Generate AI response
    const aiResponse = await generateAIResponse({
      customerMessage: message,
      customerPhone: from,
      businessId: defaultBusinessId,
      businessRules: null,
      templates: null
    });

    // Send reply
    const sentMessage = await sendWhatsAppMessage({
      to: from,
      message: aiResponse,
      phoneNumberId
    });

    // Save outgoing message
    if (sentMessage) {
      await saveMessage({
        messageId: sentMessage.messageId,
        businessId: defaultBusinessId,
        from: phoneNumberId,
        to: from,
        messageText: aiResponse,
        timestamp: new Date(),
        direction: 'outgoing',
        type: 'text'
      });
    }

    logger.info(` Replied to  successfully`);
    return;
  }

  // Normal flow with business found
  await saveMessage({
    messageId,
    businessId: business.id,
    from,
    to: phoneNumberId,
    messageText: message,
    timestamp: new Date(timestamp),
    direction: 'incoming',
    type: 'text'
  });

  const aiResponse = await generateAIResponse({
    customerMessage: message,
    customerPhone: from,
    businessId: business.id,
    businessRules: {
      businessName: business.businessName,
      businessHours: business.businessHours,
      description: business.description,
      location: business.location,
      priceList: business.priceList
    },
    templates: null
  });

  const sentMessage = await sendWhatsAppMessage({
    to: from,
    message: aiResponse,
    phoneNumberId
  });

  if (sentMessage) {
    await saveMessage({
      messageId: sentMessage.messageId,
      businessId: business.id,
      from: phoneNumberId,
      to: from,
      messageText: aiResponse,
      timestamp: new Date(),
      direction: 'outgoing',
      type: 'text'
    });
  }

  logger.info(` Replied to  successfully`);
}

/**
 * Handle Meta webhook (existing logic)
 */
async function handleMetaWebhook(body) {
  // Loop through entries (usually just one)
  for (const entry of body.entry) {
    const changes = entry.changes;

    for (const change of changes) {
      const value = change.value;

      // Check if this is a message event
      if (value.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const from = message.from;
        const messageId = message.id;
        const messageType = message.type;

        logger.info(` New message from : Type=`);

        // Only process text messages for now
        if (messageType === 'text') {
          const messageText = message.text.body;

          // Get business information based on the phone number
          const business = await getBusinessByPhone(value.metadata.phone_number_id);

          if (!business) {
            logger.error(` No business found for phone number ID: ${phoneNumberId}`);
            continue;
          }

          // Save incoming message to database
          await saveMessage({
            messageId,
            businessId: business.id,
            from,
            to: value.metadata.phone_number_id,
            messageText,
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            direction: 'incoming',
            type: messageType
          });

          // Generate AI response
          const aiResponse = await generateAIResponse({
            customerMessage: messageText,
            customerPhone: from,
            businessId: business.id,
            businessRules: {
      businessName: business.businessName,
      businessHours: business.businessHours,
      description: business.description,
      location: business.location,
      priceList: business.priceList
    },
    templates: null
          });

          // Send reply back to customer
          const sentMessage = await sendWhatsAppMessage({
            to: from,
            message: aiResponse,
            phoneNumberId: value.metadata.phone_number_id
          });

          // Save outgoing message to database
          if (sentMessage) {
            await saveMessage({
              messageId: sentMessage.messageId,
              businessId: business.id,
              from: value.metadata.phone_number_id,
              to: from,
              messageText: aiResponse,
              timestamp: new Date(),
              direction: 'outgoing',
              type: 'text'
            });
          }

          logger.info(` Replied to  successfully`);
        } else {
          logger.info(` Unsupported message type: `);
        }
      }

      // Handle message status updates (delivered, read, etc.)
      if (value.statuses && value.statuses.length > 0) {
        const status = value.statuses[0];
        logger.info(` Message status update:  - `);
      }
    }
  }
}
