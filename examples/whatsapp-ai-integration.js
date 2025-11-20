/**
 * Example WhatsApp Integration with AI Engine
 * 
 * This file demonstrates how to integrate the AI Engine
 * with your WhatsApp webhook to create intelligent,
 * context-aware responses with product recommendations.
 */

import aiEngine from '../services/aiEngine.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Handle incoming WhatsApp message
 */
export async function handleWhatsAppMessage(from, messageBody, phoneNumberId) {
  try {
    console.log(`📱 Received message from ${from}: ${messageBody}`);

    // 1. Get or create conversation
    const conversation = await getOrCreateConversation(from, phoneNumberId);
    
    // 2. Save incoming message
    await saveMessage(conversation.id, 'inbound', messageBody, from);

    // 3. Check if AI is enabled for this business
    const business = await getBusiness(conversation.business_id);
    
    if (!business.ai_enabled) {
      console.log('AI not enabled for this business');
      return;
    }

    // 4. Generate AI response using the AI Engine
    const result = await aiEngine.generateResponse(
      conversation.business_id,
      conversation.id,
      messageBody
    );

    console.log(`🤖 Generated response: ${result.response.substring(0, 100)}...`);
    console.log(`📦 Recommended ${result.productsRecommended} products`);
    console.log(`💰 Used ${result.tokensUsed} tokens`);

    // 5. Send response via WhatsApp
    await sendWhatsAppMessage(phoneNumberId, from, result.response);

    // 6. Save AI response to database
    await saveMessage(conversation.id, 'outbound', result.response, 'ai');

    // 7. Update conversation status
    await updateConversation(conversation.id, {
      last_message_at: new Date().toISOString(),
      status: 'active',
    });

    return {
      success: true,
      conversationId: conversation.id,
      response: result.response,
    };

  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    
    // Send fallback message
    await sendWhatsAppMessage(
      phoneNumberId,
      from,
      "I'm having trouble right now. Let me connect you with a team member who can help!"
    );

    throw error;
  }
}

/**
 * Handle new conversation - Send AI greeting
 */
export async function sendAIGreeting(phoneNumberId, to, businessId) {
  try {
    console.log(`👋 Sending AI greeting to ${to}`);

    // Generate personalized greeting
    const greeting = await aiEngine.generateGreeting(businessId);

    // Send greeting via WhatsApp
    await sendWhatsAppMessage(phoneNumberId, to, greeting);

    return greeting;
  } catch (error) {
    console.error('Error sending AI greeting:', error);
    
    // Fallback greeting
    const fallbackGreeting = "Hello! 👋 How can I help you today?";
    await sendWhatsAppMessage(phoneNumberId, to, fallbackGreeting);
    
    return fallbackGreeting;
  }
}

/**
 * Handle specific intents
 */
export async function handleIntent(intent, conversation, message) {
  switch (intent) {
    case 'product_inquiry':
      // Customer is asking about products
      return await handleProductInquiry(conversation, message);
    
    case 'order_status':
      // Customer wants order status
      return await handleOrderStatus(conversation, message);
    
    case 'support':
      // Customer needs support
      return await handleSupport(conversation, message);
    
    default:
      // Use general AI response
      return await aiEngine.generateResponse(
        conversation.business_id,
        conversation.id,
        message
      );
  }
}

/**
 * Handle product inquiry with enhanced recommendations
 */
async function handleProductInquiry(conversation, message) {
  try {
    // Get more product recommendations for product inquiries
    const products = await aiEngine.getRelevantProducts(
      conversation.business_id,
      message,
      10 // Get more products for product inquiries
    );

    if (products.length === 0) {
      return {
        response: "I'd love to help! Could you tell me more about what you're looking for?",
        productsRecommended: 0,
      };
    }

    // Generate response with product recommendations
    const result = await aiEngine.generateResponse(
      conversation.business_id,
      conversation.id,
      message
    );

    return result;
  } catch (error) {
    console.error('Error handling product inquiry:', error);
    throw error;
  }
}

/**
 * Handle order status inquiry
 */
async function handleOrderStatus(conversation, message) {
  try {
    // Extract order number if present
    const orderNumber = extractOrderNumber(message);

    if (orderNumber) {
      // Look up order in database
      const order = await getOrder(orderNumber, conversation.business_id);

      if (order) {
        return {
          response: `Your order #${orderNumber} is ${order.status}. ${getOrderStatusDetails(order)}`,
          productsRecommended: 0,
        };
      }
    }

    // If no order found, ask for order number
    return {
      response: "I'd be happy to check your order status! Could you please provide your order number?",
      productsRecommended: 0,
    };
  } catch (error) {
    console.error('Error handling order status:', error);
    throw error;
  }
}

/**
 * Handle support request
 */
async function handleSupport(conversation, message) {
  try {
    // Generate AI response
    const result = await aiEngine.generateResponse(
      conversation.business_id,
      conversation.id,
      message
    );

    // Also notify human agent if issue is critical
    if (isCriticalIssue(message)) {
      await notifyHumanAgent(conversation, message);
      result.response += "\n\nI've also notified our support team who will reach out shortly.";
    }

    return result;
  } catch (error) {
    console.error('Error handling support:', error);
    throw error;
  }
}

/**
 * Get or create conversation
 */
async function getOrCreateConversation(customerPhone, phoneNumberId) {
  // Try to find existing conversation
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('customer_phone', customerPhone)
    .eq('phone_number_id', phoneNumberId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    return existing;
  }

  // Get business for this phone number
  const { data: phoneNumber } = await supabase
    .from('phone_numbers')
    .select('business_id')
    .eq('phone_number_id', phoneNumberId)
    .single();

  if (!phoneNumber) {
    throw new Error('Phone number not registered');
  }

  // Create new conversation
  const { data: conversation, error } = await supabase
    .from('conversations')
    .insert({
      business_id: phoneNumber.business_id,
      customer_phone: customerPhone,
      phone_number_id: phoneNumberId,
      status: 'active',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  // Send AI greeting
  await sendAIGreeting(phoneNumberId, customerPhone, phoneNumber.business_id);

  return conversation;
}

/**
 * Save message to database
 */
async function saveMessage(conversationId, direction, text, sender) {
  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      direction: direction,
      message_text: text,
      sender: sender,
      timestamp: new Date().toISOString(),
    });

  if (error) {
    console.error('Error saving message:', error);
  }
}

/**
 * Update conversation
 */
async function updateConversation(conversationId, updates) {
  const { error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId);

  if (error) {
    console.error('Error updating conversation:', error);
  }
}

/**
 * Get business details
 */
async function getBusiness(businessId) {
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Send WhatsApp message
 */
async function sendWhatsAppMessage(phoneNumberId, to, message) {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`WhatsApp API error: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Message sent successfully:', result);
    
    return result;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    throw error;
  }
}

/**
 * Helper functions
 */

function extractOrderNumber(message) {
  // Extract order number patterns like #12345, ORD-12345, etc.
  const patterns = [
    /#(\d+)/,
    /order[:\s]+(\w+)/i,
    /ORD-(\w+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }

  return null;
}

async function getOrder(orderNumber, businessId) {
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .eq('business_id', businessId)
    .single();

  return data;
}

function getOrderStatusDetails(order) {
  switch (order.status) {
    case 'processing':
      return 'We are preparing your order and will ship it soon.';
    case 'shipped':
      return `It was shipped on ${new Date(order.shipped_at).toLocaleDateString()} and should arrive within 3-5 business days.`;
    case 'delivered':
      return `It was delivered on ${new Date(order.delivered_at).toLocaleDateString()}.`;
    default:
      return '';
  }
}

function isCriticalIssue(message) {
  const criticalKeywords = [
    'urgent',
    'emergency',
    'broken',
    'not working',
    'defective',
    'refund',
    'complaint',
  ];

  const lowerMessage = message.toLowerCase();
  return criticalKeywords.some(keyword => lowerMessage.includes(keyword));
}

async function notifyHumanAgent(conversation, message) {
  // Implementation depends on your notification system
  // Could be: email, SMS, push notification, Slack, etc.
  console.log(`🚨 Critical issue in conversation ${conversation.id}`);
  console.log(`Message: ${message}`);
  
  // Example: Send to Slack
  // await sendSlackNotification({
  //   channel: '#support-urgent',
  //   text: `Critical issue from ${conversation.customer_phone}: ${message}`,
  // });
}

/**
 * Example webhook endpoint
 */
export async function whatsappWebhook(req, res) {
  try {
    const { entry } = req.body;

    if (!entry || !entry[0]) {
      return res.sendStatus(200);
    }

    const changes = entry[0].changes;
    
    if (!changes || !changes[0]) {
      return res.sendStatus(200);
    }

    const value = changes[0].value;
    
    if (!value.messages || !value.messages[0]) {
      return res.sendStatus(200);
    }

    const message = value.messages[0];
    const from = message.from;
    const messageBody = message.text?.body;
    const phoneNumberId = value.metadata.phone_number_id;

    if (!messageBody) {
      return res.sendStatus(200);
    }

    // Handle message with AI Engine
    await handleWhatsAppMessage(from, messageBody, phoneNumberId);

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
}
