import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import usageTrackingService from './usage-tracking.service.js';
import productSyncService from './productSyncService.js';
import notificationService from './notification.service.js';

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
   * PRODUCTION-READY: Includes comprehensive business rules engine
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
        // Basic Info
        businessName: business.business_name,
        description: business.description,
        location: business.location,
        contactEmail: business.contact_email,
        contactPhone: business.contact_phone,
        
        // Store Hours
        storeHours: business.store_hours,
        businessHours: business.business_hours, // Legacy text format
        supportHours: business.support_hours,
        
        // Policies
        deliveryRules: business.delivery_rules,
        refundPolicy: business.refund_policy,
        returnPolicy: business.return_policy,
        shippingPolicy: business.shipping_policy,
        privacyPolicy: business.privacy_policy,
        termsOfService: business.terms_of_service,
        
        // AI Configuration
        aiGreeting: business.ai_greeting_message,
        aiInstructions: business.ai_instructions,
        aiFaqs: business.ai_faqs,
        aiDoNotMention: business.ai_do_not_mention,
        aiSpecialOffers: business.ai_special_offers,
        aiTone: business.ai_tone || 'professional and friendly',
        aiLanguage: business.ai_language || 'en',
        aiMaxResponseLength: business.ai_max_response_length || 500,
        
        // Rules Engine
        customRules: business.custom_rules || [],
        forbiddenResponses: business.forbidden_responses || [],
        escalationKeywords: business.escalation_keywords || [],
      };
    } catch (error) {
      console.error('Error fetching business config:', error);
      throw error;
    }
  }
  
  /**
   * Check if business is currently open
   */
  async isBusinessOpen(businessId) {
    try {
      const { data, error } = await supabase.rpc('is_business_open', {
        business_id_param: businessId
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.log('Could not check business hours:', error);
      return null; // Assume open if function doesn't exist yet
    }
  }
  
  /**
   * Get next opening time
   */
  async getNextOpeningTime(businessId) {
    try {
      const { data, error } = await supabase.rpc('get_next_opening_time', {
        business_id_param: businessId
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.log('Could not get next opening time:', error);
      return null;
    }
  }
  
  /**
   * Check for escalation keywords in customer message
   */
  checkForEscalation(message, escalationKeywords) {
    if (!escalationKeywords || escalationKeywords.length === 0) return null;
    
    const lowerMessage = message.toLowerCase();
    for (const keyword of escalationKeywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return keyword;
      }
    }
    return null;
  }
  
  /**
   * Log escalation event
   */
  async logEscalation(businessId, conversationId, customerPhone, reason, keyword) {
    try {
      await supabase.from('conversation_escalations').insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_phone: customerPhone,
        reason: reason,
        triggered_keyword: keyword,
        status: 'pending',
        priority: 'high'
      });
      console.log(`⚠️  Escalation logged for conversation ${conversationId}: ${reason}`);
    } catch (error) {
      console.error('Error logging escalation:', error);
    }
  }
  
  /**
   * Audit AI response
   */
  async auditResponse(businessId, conversationId, customerMessage, aiResponse, products, startTime, modelUsed = 'gpt-4o-mini', tokensUsed = 0) {
    try {
      const responseTime = Date.now() - startTime;
      const productIds = products?.map(p => p.product_id || p.id).filter(Boolean) || [];
      
      // Rough cost estimation (adjust based on actual pricing)
      const costPerToken = modelUsed.includes('gpt-4') ? 0.00003 : 0.000002;
      const estimatedCost = tokensUsed * costPerToken;
      
      await supabase.from('ai_response_audit').insert({
        business_id: businessId,
        conversation_id: conversationId,
        customer_message: customerMessage,
        ai_response: aiResponse,
        products_recommended: productIds,
        response_time_ms: responseTime,
        model_used: modelUsed,
        tokens_used: tokensUsed,
        cost_usd: estimatedCost
      });
    } catch (error) {
      console.error('Error auditing response:', error);
    }
  }

  /**
   * Format store hours JSON for system prompt
   */
  formatStoreHours(storeHoursJson) {
    try {
      const hours = typeof storeHoursJson === 'string' ? JSON.parse(storeHoursJson) : storeHoursJson;
      if (!hours || !hours.days) return 'Hours not configured';
      
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      let formatted = '';
      
      days.forEach(day => {
        if (hours.days[day]) {
          const dayData = hours.days[day];
          const dayName = day.charAt(0).toUpperCase() + day.slice(1);
          if (dayData.closed) {
            formatted += `\n${dayName}: Closed`;
          } else {
            formatted += `\n${dayName}: ${dayData.open} - ${dayData.close}`;
          }
        }
      });
      
      if (hours.timezone) {
        formatted += `\nTimezone: ${hours.timezone}`;
      }
      
      return formatted.trim();
    } catch (error) {
      console.error('Error formatting store hours:', error);
      return 'Hours not available';
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
      // Ensure product_url is always present in the returned product objects
      return (products || []).map(p => ({
        ...p,
        product_url: p.product_url || p.permalink || ''
      }));
    } catch (error) {
      console.error('Error getting relevant products:', error);
      return [];
    }
  }

  /**
   * Get products by price (fallback when semantic search fails)
   */
  async getProductsByPrice(businessId, maxPrice, limit = 10) {
    try {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, description, price, sale_price, category, image_url, external_id, sku, stock_quantity, source_platform')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .or(`price.lte.${maxPrice},sale_price.lte.${maxPrice}`)
        .order('price', { ascending: true })
        .limit(limit);

      if (error) throw error;

      // Transform to match product recommendation format
      return (products || []).map(p => ({
        product_id: p.id,
        product_name: p.name,
        product_description: p.description,
        price: p.price,
        sale_price: p.sale_price,
        category: p.category,
        image_url: p.image_url,
        external_id: p.external_id,
        sku: p.sku,
        stock_quantity: p.stock_quantity,
        source_platform: p.source_platform,
        product_url: p.product_url || p.permalink || ''
      }));
    } catch (error) {
      console.error('Error getting products by price:', error);
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
   * PRODUCTION-READY: Includes comprehensive business policies and rules
   */
  buildSystemPrompt(businessConfig, products, isOpen = null) {
    let systemPrompt = `You are a professional AI customer service assistant for ${businessConfig.businessName}.

CRITICAL RULES:
- ALWAYS provide product links (product_url) when customers ask for them or when recommending products
- NEVER refuse to provide a link if one is available
- ONLY provide information that you have been explicitly given - NEVER make up or guess information
- If you don't know something, politely say so and offer to connect them with a human representative
- Keep responses under ${businessConfig.aiMaxResponseLength} characters when possible for WhatsApp
- Response language: ${businessConfig.aiLanguage}`;

    // Add business description
    if (businessConfig.description) {
      systemPrompt += `\n\n=== ABOUT ${businessConfig.businessName.toUpperCase()} ===\n${businessConfig.description}`;
    }

    // Add location
    if (businessConfig.location) {
      systemPrompt += `\n\nLocation: ${businessConfig.location}`;
    }

    // Add contact information
    if (businessConfig.contactEmail || businessConfig.contactPhone) {
      systemPrompt += `\n\nContact Information:`;
      if (businessConfig.contactPhone) systemPrompt += `\nPhone: ${businessConfig.contactPhone}`;
      if (businessConfig.contactEmail) systemPrompt += `\nEmail: ${businessConfig.contactEmail}`;
    }

    // Add store hours with open/closed status
    if (businessConfig.storeHours || businessConfig.businessHours) {
      systemPrompt += `\n\n=== STORE HOURS ===`;
      if (isOpen !== null) {
        systemPrompt += `\nCurrent Status: ${isOpen ? '🟢 OPEN NOW' : '🔴 CLOSED'}`;
      }
      if (businessConfig.storeHours) {
        systemPrompt += `\n${this.formatStoreHours(businessConfig.storeHours)}`;
      } else if (businessConfig.businessHours) {
        systemPrompt += `\n${businessConfig.businessHours}`;
      }
    }

    // Add support hours
    if (businessConfig.supportHours) {
      systemPrompt += `\n\nCustomer Support Hours: ${businessConfig.supportHours}`;
    }

    // Add delivery rules
    if (businessConfig.deliveryRules) {
      systemPrompt += `\n\n=== DELIVERY INFORMATION ===`;
      const dr = businessConfig.deliveryRules;
      if (dr.free_shipping_threshold) {
        systemPrompt += `\n🎉 FREE SHIPPING on orders over $${dr.free_shipping_threshold}`;
      }
      if (dr.min_order_amount) {
        systemPrompt += `\nMinimum order: $${dr.min_order_amount}`;
      }
      if (dr.standard_delivery_time) {
        systemPrompt += `\nStandard delivery: ${dr.standard_delivery_time}`;
      }
      if (dr.express_delivery_time && dr.express_delivery_cost) {
        systemPrompt += `\nExpress delivery: ${dr.express_delivery_time} (+ $${dr.express_delivery_cost})`;
      }
      if (dr.delivery_areas) {
        systemPrompt += `\nWe deliver to: ${Array.isArray(dr.delivery_areas) ? dr.delivery_areas.join(', ') : dr.delivery_areas}`;
      }
      if (dr.restrictions) {
        systemPrompt += `\nRestrictions: ${dr.restrictions}`;
      }
    }

    // Add return policy
    if (businessConfig.returnPolicy) {
      systemPrompt += `\n\n=== RETURN POLICY ===\n${businessConfig.returnPolicy}`;
    }

    // Add refund policy
    if (businessConfig.refundPolicy) {
      systemPrompt += `\n\n=== REFUND POLICY ===\n${businessConfig.refundPolicy}`;
    }

    // Add shipping policy
    if (businessConfig.shippingPolicy) {
      systemPrompt += `\n\n=== SHIPPING POLICY ===\n${businessConfig.shippingPolicy}`;
    }

    // Add tone
    systemPrompt += `\n\n=== COMMUNICATION STYLE ===\nTone: ${businessConfig.aiTone}`;

    // Add custom instructions
    if (businessConfig.aiInstructions) {
      systemPrompt += `\n\nSpecial Instructions:\n${businessConfig.aiInstructions}`;
    }

    // Add custom rules
    if (businessConfig.customRules && businessConfig.customRules.length > 0) {
      systemPrompt += `\n\n=== BUSINESS RULES ===\n${businessConfig.customRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n')}`;
    }

    // Add FAQs
    if (businessConfig.aiFaqs) {
      systemPrompt += `\n\n=== FREQUENTLY ASKED QUESTIONS ===\n${businessConfig.aiFaqs}`;
    }

    // Add special offers
    if (businessConfig.aiSpecialOffers) {
      systemPrompt += `\n\n=== CURRENT PROMOTIONS ===\n${businessConfig.aiSpecialOffers}`;
    }

    // Add forbidden topics
    if (businessConfig.forbiddenResponses && businessConfig.forbiddenResponses.length > 0) {
      systemPrompt += `\n\n=== FORBIDDEN TOPICS ===\nYou must REFUSE to discuss or provide information about:\n${businessConfig.forbiddenResponses.map((topic, i) => `${i + 1}. ${topic}`).join('\n')}`;
      systemPrompt += `\nIf asked about these topics, politely decline and redirect to appropriate resources or human support.`;
    }

    // Add legacy "do not mention"
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
        // Add product variations/options if available
        if (product.has_variants && product.variant_options) {
          // Only include actual options from the store, not generic guesses
          const options = Object.entries(product.variant_options)
            .map(([key, values]) => {
              // Filter out empty or null values
              const filtered = Array.isArray(values) ? values.filter(v => v && v.trim()) : values;
              return `${key}: ${Array.isArray(filtered) ? filtered.join(', ') : filtered}`;
            })
            .join('; ');
          if (options && options.trim()) {
            systemPrompt += `\n   Available options: ${options}`;
          }
          // Add explicit instruction to only mention options/colors that exist for each product
          systemPrompt += `\n   IMPORTANT: Only mention options/colors that are actually available for each product. Do NOT guess or invent options.`;
        }
        if (product.product_url) {
          systemPrompt += `\n   Product Link: ${product.product_url}`;
        }
      });

      systemPrompt += `\n\n PRODUCT RECOMMENDATION RULES:\n`;
      systemPrompt += `- When asked about products, you MUST list ALL products above that match the criteria\n`;
      systemPrompt += `- ALWAYS include: Product name + Price + Product Link for each item\n`;
      systemPrompt += `- Format as a numbered or bulleted list\n`;
      systemPrompt += `- If customer asks for price range (e.g., under $50), list ALL qualifying products\n`;
      systemPrompt += `- Do NOT say "Here are SOME items" - list them ALL`;
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
  async generateResponse(businessId, conversationId, customerMessage, customerPhone = null) {
    const startTime = Date.now();
    try {
      console.log(`🤖 Generating AI response for business ${businessId}`);

      // 1. Get business configuration
      const businessConfig = await this.getBusinessConfig(businessId);

      // 2. Check for escalation keywords
      if (businessConfig.escalationKeywords && businessConfig.escalationKeywords.length > 0) {
        const triggeredKeyword = this.checkForEscalation(customerMessage, businessConfig.escalationKeywords);
        if (triggeredKeyword) {
          console.log(`⚠️  Escalation keyword detected: "${triggeredKeyword}"`);
          await this.logEscalation(
            businessId,
            conversationId,
            customerPhone,
            'Escalation keyword detected in customer message',
            triggeredKeyword
          );
          // Return escalation response
          return {
            success: true,
            response: `I understand this is important. Let me connect you with a team member who can better assist you. ${businessConfig.contactPhone ? `You can also reach us at ${businessConfig.contactPhone}` : ''}`,
            productsRecommended: 0,
            tokensUsed: 0,
            escalated: true
          };
        }
      }

      // 3. Check business hours
      const isOpen = await this.isBusinessOpen(businessId);

      // 4. Get conversation history
      const history = await this.getConversationHistory(conversationId, 8);

      // 5. Get relevant products based on current message (not full history)
      // Using only customerMessage provides cleaner semantic matching
      let products = await this.getRelevantProducts(
        businessId,
        customerMessage, // Only current query for better product matching
        5
      );


      // --- Verify product context: Log and check for correct product and URL ---
      if (products && products.length > 0) {
        const missingUrl = products.filter(p => !p.product_url).map(p => p.product_name || p.name);
        if (missingUrl.length > 0) {
          console.warn('[AIEngine] Some products are missing product_url:', missingUrl);
        }
        // Log the products array for debugging
        console.log('[AIEngine] Products context for prompt:', JSON.stringify(products, null, 2));
      } else {
        console.warn('[AIEngine] No relevant products found for context:', customerMessage);
        // Fallback: If the message is about color/options and no products found, fetch all products and reply with only real options/colors
        if (/color|colou?r|option|variant/i.test(customerMessage)) {
          // Fetch all products for the business
          const { data: allProducts, error } = await supabase
            .from('products')
            .select('name, description, variant_options')
            .eq('business_id', businessId)
            .eq('is_active', true);
          if (!error && allProducts && allProducts.length > 0) {
            // Synonym mapping for common product terms (production-ready approach)
            const synonyms = {
              'fan': ['fan', 'blower', 'cooler', 'ventilator'],
              'hat': ['hat', 'cap', 'beanie', 'headwear'],
              'shirt': ['shirt', 'tee', 't-shirt', 'top', 'blouse'],
              'pant': ['pant', 'trouser', 'jean', 'slack'],
              'shoe': ['shoe', 'sneaker', 'boot', 'footwear'],
              'bag': ['bag', 'purse', 'tote', 'backpack', 'satchel'],
            };
            
            // Tokenize query, remove stopwords/short words and color-related words (they're part of the question, not the product)
            const stopwords = new Set(['the','of','and','a','an','to','in','on','for','with','at','by','from','up','about','into','over','after','under','above','below','can','you','me','is','are','do','does','did','i','we','they','he','she','it','this','that','these','those','as','be','have','has','had','will','would','should','could','may','might','must','shall','or','so','but','if','then','than','too','very','just','not','no','yes','was','were','been','being','your','my','our','their','his','her','its','which','who','whom','whose','what','when','where','why','how','color','colour','option','variant','size','style']);
            let queryWords = customerMessage.toLowerCase().split(/\W+/)
              .filter(w => w && w.length > 2 && !stopwords.has(w))
              .map(w => w.replace(/s$/, ''));
            
            // Expand query words with synonyms
            let expandedWords = new Set(queryWords);
            queryWords.forEach(word => {
              if (synonyms[word]) {
                synonyms[word].forEach(syn => expandedWords.add(syn));
              }
            });
            queryWords = [...expandedWords];
            
            console.log(`[AIEngine] Color fallback - Query words: ${queryWords.join(', ')}`);
            
            // Score-based matching for better accuracy
            let productScores = [];
            allProducts.forEach(p => {
              const name = (p.name || '').toLowerCase();
              const desc = (p.description || '').toLowerCase();
              let score = 0;
              
              queryWords.forEach(word => {
                // Exact match in name: highest score
                if (name.includes(word)) {
                  score += 10;
                }
                // Partial match in name (first 3 chars)
                else if (word.length >= 3 && name.includes(word.substring(0, 3))) {
                  score += 5;
                }
                // Match in description
                if (desc.includes(word)) {
                  score += 3;
                }
              });
              
              if (score > 0 && p.variant_options && typeof p.variant_options === 'object') {
                productScores.push({ product: p, score });
              }
            });
            
            // Sort by score and take ONLY top matches (score threshold)
            productScores.sort((a, b) => b.score - a.score);
            console.log(`[AIEngine] Color fallback - Found ${productScores.length} matching products`);
            
            // Only use products with score >= 10 (exact name match) OR top 2 if none meet threshold
            const minScore = productScores.length > 0 && productScores[0].score >= 10 ? 10 : 0;
            const topMatches = productScores.filter(p => p.score >= minScore).slice(0, 3);
            console.log(`[AIEngine] Color fallback - Using ${topMatches.length} top-scored products (min score: ${minScore})`);
            
            let colorMap = {};
            topMatches.forEach(({ product: p }) => {
              Object.entries(p.variant_options).forEach(([key, values]) => {
                if (/color|colou?r/i.test(key) && Array.isArray(values)) {
                  if (!colorMap[p.name]) colorMap[p.name] = [];
                  colorMap[p.name].push(...values.filter(v => v && v.trim()));
                }
              });
            });
            
            // Build a strict, non-hallucinated response
            if (Object.keys(colorMap).length > 0) {
              let colorLines = Object.entries(colorMap).map(([prod, colors]) => {
                const uniqueColors = [...new Set(colors.map(c => c.trim()))];
                return `The available colors for ${prod} are: ${uniqueColors.join(', ')}`;
              });
              console.log(`[AIEngine] Color fallback - Returning colors for: ${Object.keys(colorMap).join(', ')}`);
              return {
                success: true,
                response: colorLines.join('\n'),
                productsRecommended: 0,
                tokensUsed: 0,
              };
            } else {
              console.log(`[AIEngine] Color fallback - No color options found`);
              return {
                success: true,
                response: "Sorry, I couldn't find any color options for that product.",
                productsRecommended: 0,
                tokensUsed: 0,
              };
            }
          }
        }
        // Fallback: If no products found and message mentions price, try direct price filter
        if (/under|below|less than|\$\d+/.test(customerMessage.toLowerCase())) {
          console.log(' Semantic search returned 0, trying price-based fallback...');
          const priceMatch = customerMessage.match(/\$(\d+)/);
          if (priceMatch) {
            const maxPrice = parseInt(priceMatch[1]);
            products = await this.getProductsByPrice(businessId, maxPrice);
            console.log(` Found ${products.length} products under $${maxPrice}`);
          }
        }
      }

      console.log(`📦 Found ${products.length} relevant products`);

      // 6. Build dynamic system prompt with business rules and store hours
      const systemPrompt = this.buildSystemPrompt(businessConfig, products, isOpen);

      // --- Log the final system prompt for debugging ---
      console.log('[AIEngine] Final system prompt for OpenAI:', systemPrompt);

      // 7. Build conversation messages
      const messages = this.buildConversationMessages(
        history,
        customerMessage,
        systemPrompt
      );

      // 8. Check usage limits before calling OpenAI
      const permission = await usageTrackingService.canMakeApiCall(businessId);
      if (!permission.allowed) {
        console.warn(`⚠️  API call blocked for business ${businessId}: ${permission.reason}`);
        
        // Send notification to business owner (silent to customer)
        const usagePercentage = permission.limit ? Math.round((permission.usage / permission.limit) * 100) : 100;
        await notificationService.sendUsageLimitAlert(businessId, {
          usage: permission.usage || 0,
          limit: permission.limit || 0,
          percentage: usagePercentage,
          plan: 'Current Plan',
          reason: permission.reason
        });
        
        // Return customer-friendly fallback response (NO billing language)
        const fallbackResponse = this.generateFallbackResponse(businessConfig);
        
        return {
          success: true, // Still "success" so webhook doesn't error
          response: fallbackResponse,
          productsRecommended: 0,
          tokensUsed: 0,
          limitExceeded: true
        };
      }

      // 9. Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const aiResponse = completion.choices[0].message.content;
      const tokensUsed = completion.usage.total_tokens;

      console.log(`✅ AI response generated: ${aiResponse.substring(0, 100)}...`);

      // 10. Track usage
      await usageTrackingService.trackUsage({
        businessId,
        conversationId,
        model: this.model,
        tokensInput: completion.usage.prompt_tokens,
        tokensOutput: completion.usage.completion_tokens,
        requestType: 'chat_completion',
        customerPhone,
        metadata: { 
          messageLength: customerMessage.length,
          productsRecommended: products.length
        }
      });

      // 11. Track product recommendations
      await this.trackProductRecommendations(
        conversationId,
        businessId,
        products,
        aiResponse
      );

      // 12. Audit response for quality control
      await this.auditResponse(
        businessId,
        conversationId,
        customerMessage,
        aiResponse,
        products,
        startTime,
        this.model,
        tokensUsed
      );

      return {
        success: true,
        response: aiResponse,
        productsRecommended: products.length,
        tokensUsed: tokensUsed,
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
   * Generate fallback response when usage limit is reached
   * NEVER mentions billing/subscription to customers
   */
  generateFallbackResponse(businessConfig) {
    const contactInfo = [];
    
    if (businessConfig.contactPhone) {
      contactInfo.push(`📱 ${businessConfig.contactPhone}`);
    }
    if (businessConfig.contactEmail) {
      contactInfo.push(`📧 ${businessConfig.contactEmail}`);
    }
    
    const contactString = contactInfo.length > 0 
      ? `\n\nYou can reach us at:\n${contactInfo.join('\n')}`
      : '';
    
    // Professional, customer-friendly response
    let fallback = `Thank you for contacting ${businessConfig.businessName}! 👋\n\n`;
    fallback += `We're currently experiencing high message volume. `;
    fallback += `For immediate assistance, please contact us directly and one of our team members will be happy to help you!`;
    fallback += contactString;
    
    // Add business hours if available
    if (businessConfig.storeHours || businessConfig.businessHours) {
      fallback += `\n\n⏰ Our hours:\n`;
      if (businessConfig.storeHours) {
        fallback += this.formatStoreHours(businessConfig.storeHours);
      } else {
        fallback += businessConfig.businessHours;
      }
    }
    
    fallback += `\n\nWe look forward to assisting you! 😊`;
    
    return fallback;
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

