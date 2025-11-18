import axios from 'axios';
import { logger } from '../utils/logger.js';
import { getConversationHistory } from './database.service.js';

/**
 * Generate AI response using OpenAI (you can swap this with other providers)
 */
export const generateAIResponse = async ({ 
  customerMessage, 
  customerPhone, 
  businessId, 
  businessRules, 
  templates 
}) => {
  try {
    // Check if AI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      logger.warn('⚠️  No AI API key configured, using fallback response');
      return generateFallbackResponse(customerMessage, templates);
    }

    // Get conversation history for context
    const conversationHistory = await getConversationHistory(businessId, customerPhone, 5);

    // Build the system prompt with business rules and templates
    const systemPrompt = buildSystemPrompt(businessRules, templates);

    // Build conversation messages for the AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.direction === 'incoming' ? 'user' : 'assistant',
        content: msg.messageText
      })),
      { role: 'user', content: customerMessage }
    ];

    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4-turbo-preview', // or 'gpt-3.5-turbo' for lower cost
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiReply = response.data.choices[0].message.content.trim();
    logger.info('✅ AI response generated successfully');
    return aiReply;

  } catch (error) {
    logger.error('❌ Error generating AI response:', error.response?.data || error.message);
    
    // Fallback to template-based response if AI fails
    return generateFallbackResponse(customerMessage, templates);
  }
};

/**
 * Build system prompt with business context
 */
const buildSystemPrompt = (businessRules, templates) => {
  let prompt = `You are a helpful customer service AI assistant for a business on WhatsApp. 
Your goal is to provide accurate, friendly, and professional responses to customer inquiries.

IMPORTANT GUIDELINES:
- Always be polite and professional
- Keep responses concise (under 300 characters when possible for WhatsApp)
- Use the business information provided below to answer questions
- If you don't know something, politely say so and offer to connect them with a human
- Never make up information not provided in the business rules

`;

  // Add business rules
  if (businessRules) {
    prompt += `\nBUSINESS INFORMATION:\n`;
    if (businessRules.businessName) prompt += `Business Name: ${businessRules.businessName}\n`;
    if (businessRules.businessHours) prompt += `Business Hours: ${businessRules.businessHours}\n`;
    if (businessRules.description) prompt += `Description: ${businessRules.description}\n`;
    if (businessRules.specialInstructions) prompt += `Special Instructions: ${businessRules.specialInstructions}\n`;
  }

  // Add templates/common responses
  if (templates && Object.keys(templates).length > 0) {
    prompt += `\nCOMMON INFORMATION:\n`;
    Object.entries(templates).forEach(([key, value]) => {
      prompt += `${key}: ${value}\n`;
    });
  }

  return prompt;
};

/**
 * Fallback response when AI is not available or fails
 */
const generateFallbackResponse = (message, templates) => {
  const lowerMessage = message.toLowerCase();

  // Simple keyword matching
  if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('how much')) {
    return templates?.priceList || 
      'Thank you for your inquiry! Please let me know which product or service you\'re interested in, and I\'ll provide pricing details.';
  }

  if (lowerMessage.includes('hours') || lowerMessage.includes('open') || lowerMessage.includes('when')) {
    return templates?.businessHours || 
      'We\'re here to help! Our business hours are Monday-Friday, 9 AM - 6 PM. How can I assist you today?';
  }

  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return 'Hello! 👋 Thank you for contacting us. How can I help you today?';
  }

  if (lowerMessage.includes('location') || lowerMessage.includes('address') || lowerMessage.includes('where')) {
    return templates?.location || 
      'Thank you for asking! Please let me know if you need our address or directions.';
  }

  // Default response
  return 'Thank you for your message! I\'m here to help. Could you please provide more details about your inquiry?';
};

/**
 * Alternative: Google Gemini AI (uncomment to use)
 */
// export const generateGeminiResponse = async (prompt) => {
//   const response = await axios.post(
//     `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
//     {
//       contents: [{ parts: [{ text: prompt }] }]
//     }
//   );
//   return response.data.candidates[0].content.parts[0].text;
// };
