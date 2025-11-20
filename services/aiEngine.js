import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import productSyncService from './productSyncService.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

class AIEngine {
  constructor() {
    this.model = 'gpt-4o-mini';
    this.temperature = 0.7;
    this.maxTokens = 500;
  }

  /**
   * Get business configuration (rules, AI settings, preferences)
   */
  async getBusinessConfig(businessId) {
    try {
      const { data: business, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .single();

      if (error) throw error;

      return {
        businessName: business.business_name,
        description: business.description,
        aiGreeting: business.ai_greeting_message,
        aiInstructions: business.ai_instructions,
        aiFaqs: business.ai_faqs,
        aiDoNotMention: business.ai_do_not_mention,
        aiSpecialOffers: business.ai_special_offers,
        aiTone: business.ai_tone || 'professional and friendly',
        customRules: business.custom_rules || [],
      };
    } catch (error) {
      console.error('Error fetching business config:', error);
      throw error;
    }
  }

  /**
   * Get relevant products based on conversation context
   */
  async getRelevantProducts(businessId, conversationContext, limit = 5) {
    try {
      // Use product sync service to search for relevant products
      const products = await productSyncService.getRecommendations(
        businessId,
        conversationContext,
        limit
      );

      return products;
    } catch (error) {
      console.error('Error getting relevant products:', error);
      return [];
    }
  }

  /**
   * Get conversation history for context
   */
  async getConversationHistory(conversationId, limit = 10) {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('direction, message_text, timestamp')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Reverse to get chronological order
      return messages ? messages.reverse() : [];
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      return [];
    }
  }

  /**
   * Build dynamic system prompt with business rules and product data
   */
  buildSystemPrompt(businessConfig, products) {
    let systemPrompt = `You are an AI assistant for ${businessConfig.businessName}.`;

    // Add business description
    if (businessConfig.description) {
      systemPrompt += `\n\nBusiness Description: ${businessConfig.description}`;
    }

    // Add tone
    systemPrompt += `\n\nYour tone should be: ${businessConfig.aiTone}`;

    // Add custom instructions
    if (businessConfig.aiInstructions) {
      systemPrompt += `\n\nInstructions:\n${businessConfig.aiInstructions}`;
    }

    // Add custom rules
    if (businessConfig.customRules && businessConfig.customRules.length > 0) {
      systemPrompt += `\n\nRules to follow:\n${businessConfig.customRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`;
    }

    // Add FAQs
    if (businessConfig.aiFaqs) {
      systemPrompt += `\n\nFrequently Asked Questions:\n${businessConfig.aiFaqs}`;
    }

    // Add special offers
    if (businessConfig.aiSpecialOffers) {
      systemPrompt += `\n\nCurrent Special Offers:\n${businessConfig.aiSpecialOffers}`;
    }

    // Add things not to mention
    if (businessConfig.aiDoNotMention) {
      systemPrompt += `\n\nDo NOT mention or discuss:\n${businessConfig.aiDoNotMention}`;
    }

    // Add product catalog
    if (products && products.length > 0) {
      systemPrompt += `\n\n=== AVAILABLE PRODUCTS ===`;
      systemPrompt += `\n\nHere are relevant products from our catalog that you can recommend:`;

      products.forEach((product, index) => {
        systemPrompt += `\n\n${index + 1}. ${product.product_name}`;
        if (product.price) {
          systemPrompt += `\n   Price: $${parseFloat(product.price).toFixed(2)}`;
        }
        if (product.category) {
          systemPrompt += `\n   Category: ${product.category}`;
        }
        if (product.product_description) {
          systemPrompt += `\n   Description: ${product.product_description}`;
        }
      });

      systemPrompt += `\n\nWhen recommending products, mention the name, price, and key benefits. Be helpful and answer questions about products naturally.`;
    }

    // General guidelines
    systemPrompt += `\n\n=== GENERAL GUIDELINES ===`;
    systemPrompt += `\n- Keep responses concise (2-3 sentences unless more detail is needed)`;
    systemPrompt += `\n- Be helpful, professional, and friendly`;
    systemPrompt += `\n- If you don't know something, admit it and offer to help in another way`;
    systemPrompt += `\n- Focus on solving the customer's needs`;
    systemPrompt += `\n- Use emojis sparingly and only when appropriate`;

    return systemPrompt;
  }

  /**
   * Build conversation messages for OpenAI
   */
  buildConversationMessages(history, currentMessage, systemPrompt) {
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history
    history.forEach(msg => {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.message_text
      });
    });

    // Add current message
    messages.push({
      role: 'user',
      content: currentMessage
    });

    return messages;
  }

  /**
   * Generate AI response for customer message
   */
  async generateResponse(businessId, conversationId, customerMessage) {
    try {
      console.log(`🤖 Generating AI response for business ${businessId}`);

      // 1. Get business configuration
      const businessConfig = await this.getBusinessConfig(businessId);

      // 2. Get conversation history
      const history = await this.getConversationHistory(conversationId, 8);

      // 3. Get relevant products based on context
      const conversationContext = history
        .map(msg => msg.message_text)
        .join(' ') + ' ' + customerMessage;

      const products = await this.getRelevantProducts(
        businessId,
        conversationContext,
        5
      );

      console.log(`📦 Found ${products.length} relevant products`);

      // 4. Build dynamic system prompt
      const systemPrompt = this.buildSystemPrompt(businessConfig, products);

      // 5. Build conversation messages
      const messages = this.buildConversationMessages(
        history,
        customerMessage,
        systemPrompt
      );

      // 6. Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const aiResponse = completion.choices[0].message.content;

      console.log(`✅ AI response generated: ${aiResponse.substring(0, 100)}...`);

      // 7. Track product recommendations
      await this.trackProductRecommendations(
        conversationId,
        businessId,
        products,
        aiResponse
      );

      return {
        success: true,
        response: aiResponse,
        productsRecommended: products.length,
        tokensUsed: completion.usage.total_tokens,
      };
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  /**
   * Track which products were recommended in conversation
   */
  async trackProductRecommendations(conversationId, businessId, products, aiResponse) {
    try {
      // Check if any products were mentioned in the response
      const recommendedProducts = products.filter(product =>
        aiResponse.toLowerCase().includes(product.product_name.toLowerCase())
      );

      if (recommendedProducts.length === 0) return;

      // Save to product_recommendations table
      const recommendations = recommendedProducts.map(product => ({
        conversation_id: conversationId,
        business_id: businessId,
        product_id: product.product_id,
        recommended_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('product_recommendations')
        .insert(recommendations);

      if (error) {
        console.error('Error tracking product recommendations:', error);
      } else {
        console.log(`📊 Tracked ${recommendations.length} product recommendations`);
      }
    } catch (error) {
      console.error('Error in trackProductRecommendations:', error);
    }
  }

  /**
   * Generate greeting message for new conversation
   */
  async generateGreeting(businessId) {
    try {
      const businessConfig = await this.getBusinessConfig(businessId);

      // Use custom greeting if available
      if (businessConfig.aiGreeting) {
        return businessConfig.aiGreeting;
      }

      // Generate dynamic greeting
      const systemPrompt = `You are an AI assistant for ${businessConfig.businessName}. Generate a warm, welcoming greeting message for a new customer. Keep it brief (1-2 sentences) and ${businessConfig.aiTone}.`;

      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Generate a greeting message' }
        ],
        temperature: 0.8,
        max_tokens: 100,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating greeting:', error);
      // Fallback greeting
      return "Hello! 👋 Welcome! How can I help you today?";
    }
  }

  /**
   * Analyze customer intent
   */
  analyzeIntent(message) {
    const lowerMessage = message.toLowerCase();

    // Product inquiry
    if (
      lowerMessage.includes('price') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('how much') ||
      lowerMessage.includes('show me') ||
      lowerMessage.includes('looking for') ||
      lowerMessage.includes('need') ||
      lowerMessage.includes('want to buy')
    ) {
      return 'product_inquiry';
    }

    // Support/Help
    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('support') ||
      lowerMessage.includes('problem') ||
      lowerMessage.includes('issue')
    ) {
      return 'support';
    }

    // Order status
    if (
      lowerMessage.includes('order') ||
      lowerMessage.includes('track') ||
      lowerMessage.includes('delivery') ||
      lowerMessage.includes('shipping')
    ) {
      return 'order_status';
    }

    // Greeting
    if (
      lowerMessage.includes('hi') ||
      lowerMessage.includes('hello') ||
      lowerMessage.includes('hey')
    ) {
      return 'greeting';
    }

    return 'general';
  }
}

// Create singleton instance
const aiEngine = new AIEngine();

export default aiEngine;
