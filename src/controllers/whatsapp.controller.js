import { sendWhatsAppMessage } from '../services/whatsapp.service.js';
import { generateAIResponse } from '../services/ai.service.js';
import { saveMessage, getBusinessByPhone } from '../services/database.service.js';
import { logger } from '../utils/logger.js';

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
      logger.info('✅ Webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      logger.error('❌ Webhook verification failed');
      res.sendStatus(403);
    }
  } else {
    logger.error('❌ Missing webhook verification parameters');
    res.sendStatus(400);
  }
};

/**
 * Handle incoming WhatsApp messages (POST request from Meta)
 */
export const handleWebhook = async (req, res) => {
  // Respond quickly to Meta to avoid timeout
  res.sendStatus(200);

  try {
    const body = req.body;

    // Check if this is a WhatsApp message event
    if (body.object === 'whatsapp_business_account') {
      // Loop through entries (usually just one)
      for (const entry of body.entry) {
        const changes = entry.changes;

        for (const change of changes) {
          const value = change.value;

          // Check if this is a message event
          if (value.messages && value.messages.length > 0) {
            const message = value.messages[0];
            const from = message.from; // Customer phone number
            const messageId = message.id;
            const messageType = message.type;

            logger.info(`📩 New message from ${from}: Type=${messageType}`);

            // Only process text messages for now
            if (messageType === 'text') {
              const messageText = message.text.body;
              
              // Get business information based on the phone number
              const business = await getBusinessByPhone(value.metadata.phone_number_id);
              
              if (!business) {
                logger.error(`❌ No business found for phone number ID: ${value.metadata.phone_number_id}`);
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
                businessRules: business.rules,
                templates: business.templates
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

              logger.info(`✅ Replied to ${from} successfully`);
            } else {
              logger.info(`⚠️  Unsupported message type: ${messageType}`);
            }
          }

          // Handle message status updates (delivered, read, etc.)
          if (value.statuses && value.statuses.length > 0) {
            const status = value.statuses[0];
            logger.info(`📊 Message status update: ${status.id} - ${status.status}`);
          }
        }
      }
    }
  } catch (error) {
    logger.error('❌ Error processing webhook:', error);
  }
};
