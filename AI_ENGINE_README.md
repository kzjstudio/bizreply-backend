# AI Engine Documentation

## Overview

The AI Engine is the core intelligence system of BizReply that powers AI-driven customer interactions. It dynamically pulls store rules, matches relevant products, and injects context-aware data into prompts to generate personalized responses.

## Architecture

```
Customer Message
       ↓
   AI Engine
       ↓
   ┌─────────────────────────────┐
   │  1. Get Business Config     │ ← Store rules, preferences
   │  2. Get Conversation History│ ← Past interactions
   │  3. Get Relevant Products   │ ← Vector search
   │  4. Build Dynamic Prompt    │ ← Inject all context
   │  5. Call OpenAI API         │ ← Generate response
   │  6. Track Recommendations   │ ← Analytics
   └─────────────────────────────┘
       ↓
   AI Response
```

## Features

### 1. **Dynamic Context Building**
- Pulls business rules and preferences from database
- Retrieves conversation history for context
- Uses semantic search to find relevant products
- Builds custom system prompts with all context

### 2. **Product Integration**
- Semantic search using vector embeddings
- Recommends up to 5 relevant products per response
- Includes product details (name, price, description)
- Tracks which products were mentioned

### 3. **Store Rules & Preferences**
- Custom AI instructions
- Business tone (professional, casual, friendly, etc.)
- FAQs and special offers
- Topics to avoid (do not mention list)
- Custom business rules

### 4. **Intent Analysis**
- Detects customer intent automatically:
  - `product_inquiry` - Looking for products
  - `support` - Needs help
  - `order_status` - Tracking orders
  - `greeting` - Initial contact
  - `general` - Other inquiries

### 5. **Analytics & Tracking**
- Tracks product recommendations
- Monitors click-through rates
- Measures purchase conversion
- Provides recommendation statistics

## Database Schema

### Product Recommendations Table
```sql
CREATE TABLE product_recommendations (
  id UUID PRIMARY KEY,
  conversation_id UUID,
  business_id UUID,
  product_id UUID,
  recommended_at TIMESTAMPTZ,
  clicked BOOLEAN,
  purchased BOOLEAN
);
```

### Business AI Configuration
```sql
ALTER TABLE businesses ADD COLUMN:
- ai_tone TEXT
- custom_rules JSONB
- ai_greeting_message TEXT
- ai_instructions TEXT
- ai_faqs TEXT
- ai_do_not_mention TEXT
- ai_special_offers TEXT
```

## API Endpoints

### 1. Generate AI Response
**POST** `/api/ai/generate`

Generate an AI response for a customer message.

**Request Body:**
```json
{
  "businessId": "uuid",
  "conversationId": "uuid",
  "message": "I'm looking for a laptop under $1000"
}
```

**Response:**
```json
{
  "success": true,
  "response": "I'd be happy to help! We have several great laptops under $1000...",
  "productsRecommended": 3,
  "tokensUsed": 450
}
```

### 2. Generate Greeting
**POST** `/api/ai/greeting`

Generate a personalized greeting for a new conversation.

**Request Body:**
```json
{
  "businessId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "greeting": "Hi! Welcome to TechStore. How can I help you today? 👋"
}
```

### 3. Analyze Intent
**POST** `/api/ai/intent`

Analyze the intent of a customer message.

**Request Body:**
```json
{
  "message": "How much does this cost?"
}
```

**Response:**
```json
{
  "success": true,
  "intent": "product_inquiry"
}
```

### 4. Get AI Configuration
**GET** `/api/ai/config/:businessId`

Get AI configuration for a business.

**Response:**
```json
{
  "success": true,
  "config": {
    "businessName": "TechStore",
    "description": "Online electronics retailer",
    "aiTone": "professional and friendly",
    "aiInstructions": "Always be helpful...",
    "customRules": ["Rule 1", "Rule 2"],
    "aiFaqs": "Q: Shipping? A: Free over $50",
    "aiSpecialOffers": "20% off laptops this week"
  }
}
```

### 5. Test AI Response
**POST** `/api/ai/test`

Test AI response with custom parameters (for debugging).

**Request Body:**
```json
{
  "businessId": "uuid",
  "message": "Show me laptops",
  "includeProducts": true,
  "includeHistory": false
}
```

**Response:**
```json
{
  "success": true,
  "test": {
    "businessConfig": {...},
    "productsFound": 5,
    "products": [...],
    "systemPrompt": "You are an AI assistant for...",
    "messagesCount": 2
  }
}
```

## Integration Guide

### Step 1: Update WhatsApp Controller

Update your WhatsApp message handler to use the AI engine:

```javascript
import aiEngine from '../services/aiEngine.js';

// In your message handler
async function handleIncomingMessage(from, message, conversationId, businessId) {
  try {
    // Generate AI response
    const result = await aiEngine.generateResponse(
      businessId,
      conversationId,
      message
    );

    // Send response via WhatsApp
    await sendWhatsAppMessage(from, result.response);

    // Save AI response to database
    await saveMessage(conversationId, 'outbound', result.response);

  } catch (error) {
    console.error('Error handling message:', error);
    // Fallback response
    await sendWhatsAppMessage(from, "Sorry, I'm having trouble right now. Please try again.");
  }
}
```

### Step 2: Configure Business AI Settings

In your Flutter app, add AI configuration fields to the business settings screen:

```dart
// In business settings
TextField(
  controller: _aiToneController,
  decoration: InputDecoration(
    labelText: 'AI Tone',
    hintText: 'e.g., professional and friendly',
  ),
)

TextField(
  controller: _aiInstructionsController,
  decoration: InputDecoration(
    labelText: 'AI Instructions',
    hintText: 'Custom instructions for the AI...',
  ),
  maxLines: 3,
)

TextField(
  controller: _aiFaqsController,
  decoration: InputDecoration(
    labelText: 'FAQs',
    hintText: 'Common questions and answers...',
  ),
  maxLines: 3,
)

TextField(
  controller: _aiSpecialOffersController,
  decoration: InputDecoration(
    labelText: 'Special Offers',
    hintText: 'Current promotions...',
  ),
  maxLines: 2,
)
```

### Step 3: Run Database Migration

Execute the AI engine SQL file in Supabase:

1. Go to Supabase SQL Editor
2. Run `database/ai_engine.sql`
3. Verify table created: `SELECT * FROM product_recommendations LIMIT 1;`

### Step 4: Test the Integration

```bash
# Test greeting generation
curl -X POST http://localhost:3000/api/ai/greeting \
  -H "Content-Type: application/json" \
  -d '{"businessId": "your-business-id"}'

# Test AI response
curl -X POST http://localhost:3000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "your-business-id",
    "conversationId": "test-conversation-id",
    "message": "Show me laptops under $1000"
  }'
```

## How It Works

### System Prompt Construction

The AI engine dynamically builds prompts with this structure:

```
1. BUSINESS IDENTITY
   - Business name and description
   - Desired tone

2. CUSTOM INSTRUCTIONS
   - Business-specific guidelines
   - Custom rules to follow

3. KNOWLEDGE BASE
   - FAQs
   - Special offers
   - Topics to avoid

4. PRODUCT CATALOG
   - Relevant products (vector search)
   - Product details (name, price, description)

5. GENERAL GUIDELINES
   - Response length
   - Professional behavior
   - Fallback strategies
```

### Example System Prompt

```
You are an AI assistant for TechStore.

Business Description: Leading online electronics retailer specializing in computers and accessories.

Your tone should be: professional and friendly

Instructions:
Always mention our 30-day return policy
Recommend extended warranty for items over $500

Rules to follow:
1. Never discuss competitor prices
2. Always ask for budget before recommending
3. Mention free shipping for orders over $50

Frequently Asked Questions:
Q: What's your return policy?
A: 30 days, no questions asked

Current Special Offers:
20% off all laptops this week with code LAPTOP20

Do NOT mention or discuss:
- Political topics
- Competitor products

=== AVAILABLE PRODUCTS ===

Here are relevant products from our catalog:

1. Dell XPS 13 Laptop
   Price: $899.99
   Category: Laptops
   Description: Ultra-thin 13" laptop with Intel i5...

2. HP Pavilion Gaming Laptop
   Price: $749.99
   Category: Laptops
   Description: 15.6" gaming laptop with GTX 1650...

When recommending products, mention the name, price, and key benefits.

=== GENERAL GUIDELINES ===
- Keep responses concise (2-3 sentences)
- Be helpful, professional, and friendly
- If you don't know something, admit it
- Focus on solving customer needs
```

### Product Matching Logic

1. **Extract Context**: Combines conversation history + current message
2. **Generate Query Embedding**: Uses OpenAI to create vector for query
3. **Semantic Search**: Uses pgvector cosine similarity to find relevant products
4. **Rank Results**: Orders by similarity score (threshold: 0.7)
5. **Return Top 5**: Returns most relevant products

### Recommendation Tracking

The system tracks:
- **When**: Product was mentioned (recommended_at)
- **What**: Which product was recommended
- **Where**: In which conversation
- **Result**: Did customer click or purchase?

Analytics functions:
- `get_product_recommendation_stats()` - Aggregated statistics
- `get_conversation_recommendations()` - Per-conversation history

## Configuration Options

### AI Model Settings

Edit `services/aiEngine.js`:

```javascript
class AIEngine {
  constructor() {
    this.model = 'gpt-4o-mini'; // or 'gpt-4o' for better quality
    this.temperature = 0.7;      // 0.0 = deterministic, 1.0 = creative
    this.maxTokens = 500;        // Max response length
  }
}
```

### Product Search Settings

Edit `services/aiEngine.js`:

```javascript
async getRelevantProducts(businessId, conversationContext, limit = 5) {
  // Change limit to adjust number of products
  const products = await productSyncService.getRecommendations(
    businessId,
    conversationContext,
    limit // Adjust: 3, 5, 10
  );
}
```

### Conversation History Length

```javascript
async getConversationHistory(conversationId, limit = 10) {
  // Change limit to adjust history depth
  // More history = better context but higher cost
}
```

## Cost Estimates

### OpenAI API Usage

**Per Conversation Message:**
- Input tokens: ~800-1200 tokens (prompt + history + products)
- Output tokens: ~100-200 tokens (response)
- **Cost**: ~$0.003 per message with gpt-4o-mini

**Example: 1000 messages/day**
- Daily cost: ~$3.00
- Monthly cost: ~$90.00

### With gpt-4o (higher quality):
- **Cost**: ~$0.015 per message
- Monthly (1000 msg/day): ~$450

## Monitoring

### Check AI Engine Status

```javascript
// Get configuration
const config = await aiEngine.getBusinessConfig(businessId);
console.log('AI Tone:', config.aiTone);
console.log('Custom Rules:', config.customRules);

// Get recommendation stats
const { data } = await supabase.rpc('get_product_recommendation_stats', {
  p_business_id: businessId,
  p_days: 30
});
console.log('Top Recommended Products:', data);
```

### Logs to Monitor

```
🤖 Generating AI response for business {businessId}
📦 Found {count} relevant products
✅ AI response generated: {preview}...
📊 Tracked {count} product recommendations
```

## Troubleshooting

### Issue: No products recommended

**Cause**: No products have embeddings yet
**Solution**: 
1. Ensure product sync service is running
2. Wait for hourly sync or trigger manual sync
3. Verify: `SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL;`

### Issue: AI responses are generic

**Cause**: Business configuration incomplete
**Solution**: Add more details to:
- AI instructions
- FAQs
- Special offers
- Business description

### Issue: High costs

**Solution**: 
1. Reduce conversation history limit (10 → 5)
2. Reduce product recommendations (5 → 3)
3. Switch to gpt-4o-mini if using gpt-4o
4. Implement caching for frequent queries

### Issue: Slow responses

**Cause**: Vector search + OpenAI API latency
**Solution**:
1. Optimize product embeddings index
2. Reduce max_tokens (500 → 300)
3. Use streaming responses
4. Cache common queries

## Best Practices

1. **Keep Instructions Clear**: Write specific, actionable guidelines
2. **Update FAQs Regularly**: Keep information current
3. **Monitor Recommendations**: Review which products are suggested
4. **Set Appropriate Tone**: Match your brand voice
5. **Use Custom Rules**: Add business-specific policies
6. **Track Analytics**: Monitor click-through and conversion rates
7. **Test Responses**: Use `/api/ai/test` endpoint for debugging
8. **Optimize Costs**: Balance quality with token usage

## Next Steps

1. ✅ Run `database/ai_engine.sql` in Supabase
2. ✅ Integrate AI engine into WhatsApp controller
3. ✅ Add AI configuration fields to business settings
4. ✅ Test with sample conversations
5. ✅ Monitor recommendation analytics
6. ✅ Optimize based on user feedback

## Support

For issues or questions:
- Check server logs for error messages
- Use `/api/ai/test` endpoint for debugging
- Verify database tables created correctly
- Ensure OpenAI API key is valid
- Check product embeddings exist
