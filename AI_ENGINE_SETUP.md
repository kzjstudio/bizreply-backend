# AI Engine Setup Summary

## ✅ What Was Created

### Backend Services

1. **`services/aiEngine.js`** - Core AI intelligence system
   - Pulls business rules and preferences
   - Performs semantic product search
   - Builds dynamic prompts with context
   - Generates AI responses via OpenAI
   - Tracks product recommendations

2. **`routes/ai.js`** - REST API endpoints
   - `POST /api/ai/generate` - Generate AI response
   - `POST /api/ai/greeting` - Generate greeting
   - `POST /api/ai/intent` - Analyze intent
   - `GET /api/ai/config/:businessId` - Get AI config
   - `POST /api/ai/test` - Test AI with parameters

3. **`examples/whatsapp-ai-integration.js`** - Integration example
   - Complete WhatsApp webhook implementation
   - Shows how to handle incoming messages
   - Demonstrates intent-based routing
   - Includes error handling and fallbacks

### Database Migration

4. **`database/ai_engine.sql`** - Database schema
   - `product_recommendations` table for tracking
   - New columns added to `businesses` table:
     - `ai_tone`
     - `custom_rules`
     - `ai_greeting_message`
     - `ai_instructions`
     - `ai_faqs`
     - `ai_do_not_mention`
     - `ai_special_offers`
   - Analytics functions:
     - `get_product_recommendation_stats()`
     - `get_conversation_recommendations()`

### Documentation

5. **`AI_ENGINE_README.md`** - Comprehensive documentation
   - Architecture overview
   - API endpoint reference
   - Integration guide
   - Configuration options
   - Cost estimates
   - Troubleshooting guide

## 🚀 How It Works

```
Customer Message
       ↓
1. Get Business Rules ← Store preferences, AI tone, FAQs
       ↓
2. Get Conversation History ← Past messages for context
       ↓
3. Search Products ← Vector similarity search (pgvector)
       ↓
4. Build Dynamic Prompt ← Inject all context
       ↓
5. Call OpenAI API ← Generate personalized response
       ↓
6. Track Recommendations ← Log which products mentioned
       ↓
AI Response + Products
```

## 📋 Setup Steps

### Step 1: Run Database Migration

In Supabase SQL Editor, execute:

```sql
-- From database/ai_engine.sql
-- This creates product_recommendations table
-- and adds AI configuration columns to businesses table
```

### Step 2: Configure Business AI Settings

Add these fields to your business settings in Flutter app:

- **AI Tone**: "professional and friendly"
- **AI Instructions**: Custom guidelines for your business
- **FAQs**: Common questions and answers
- **Special Offers**: Current promotions
- **Do Not Mention**: Topics to avoid

### Step 3: Integrate with WhatsApp

Update your WhatsApp webhook to use AI engine:

```javascript
import aiEngine from '../services/aiEngine.js';

// In message handler
const result = await aiEngine.generateResponse(
  businessId,
  conversationId,
  customerMessage
);

await sendWhatsAppMessage(from, result.response);
```

### Step 4: Deploy to Render

Already done! Changes are pushed to GitHub:
- Commit: `99ab060`
- Render will auto-deploy

### Step 5: Test the AI

```bash
# Test AI response
curl -X POST https://bizreply-backend.onrender.com/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "your-business-id",
    "conversationId": "test-conv-id",
    "message": "Show me your best laptops"
  }'
```

## 🎯 Key Features

### 1. Dynamic Prompt Injection

The AI engine automatically builds prompts with:
- Business identity and description
- Custom rules and guidelines
- FAQs and special offers
- Relevant products from catalog
- Conversation history

### 2. Semantic Product Search

Uses vector embeddings to find relevant products:
- Searches based on conversation context
- Returns top 5 most relevant products
- Includes product details in AI prompt

### 3. Intent Analysis

Automatically detects customer intent:
- `product_inquiry` - Looking for products
- `support` - Needs help
- `order_status` - Tracking orders
- `greeting` - Initial contact
- `general` - Other inquiries

### 4. Recommendation Tracking

Tracks product recommendations:
- Which products were mentioned
- In which conversations
- Click-through rates
- Purchase conversions

### 5. Cost Optimization

Efficient token usage:
- Concise responses (2-3 sentences)
- Limited conversation history (8 messages)
- Selective product inclusion (5 products)
- Uses cost-effective gpt-4o-mini model

## 💰 Cost Estimates

**Per message with gpt-4o-mini:**
- Input: ~1000 tokens (prompt + history + products)
- Output: ~150 tokens (response)
- **Cost**: ~$0.003 per message

**Monthly cost (1000 messages/day):**
- Daily: ~$3.00
- Monthly: ~$90.00

## 🔧 Configuration

### Change AI Model

Edit `services/aiEngine.js`:

```javascript
this.model = 'gpt-4o-mini'; // or 'gpt-4o' for better quality
this.temperature = 0.7;      // 0.0-1.0 (lower = more focused)
this.maxTokens = 500;        // Max response length
```

### Adjust Product Recommendations

```javascript
await aiEngine.getRelevantProducts(
  businessId,
  context,
  5  // Change: 3 (fewer), 10 (more)
);
```

### Modify Conversation History

```javascript
await aiEngine.getConversationHistory(
  conversationId,
  8  // Change: 5 (less context), 15 (more context)
);
```

## 📊 Analytics

### Get Recommendation Stats

```javascript
const { data } = await supabase.rpc(
  'get_product_recommendation_stats',
  {
    p_business_id: businessId,
    p_days: 30
  }
);

// Returns: product_name, times_recommended, 
//          click_rate, purchase_rate
```

### Get Conversation Recommendations

```javascript
const { data } = await supabase.rpc(
  'get_conversation_recommendations',
  {
    p_conversation_id: conversationId
  }
);

// Returns: All products recommended in conversation
```

## 🐛 Troubleshooting

### No products recommended?

**Check:**
1. Product sync service running?
2. Products have embeddings? `SELECT COUNT(*) FROM products WHERE embedding IS NOT NULL;`
3. pgvector extension enabled? `CREATE EXTENSION vector;`

### AI responses are generic?

**Add more configuration:**
1. Set AI instructions in business settings
2. Add FAQs and special offers
3. Define custom rules
4. Improve business description

### High OpenAI costs?

**Optimize:**
1. Reduce conversation history (8 → 5)
2. Reduce product recommendations (5 → 3)
3. Use shorter system prompts
4. Implement response caching

## 🎉 What's Next?

1. **Run database migration** (`database/ai_engine.sql`)
2. **Add AI config fields** to business settings screen
3. **Integrate with WhatsApp** using example code
4. **Test with sample conversations**
5. **Monitor recommendation analytics**
6. **Optimize based on feedback**

## 📚 Documentation

- **Full API Reference**: `AI_ENGINE_README.md`
- **Integration Example**: `examples/whatsapp-ai-integration.js`
- **Database Schema**: `database/ai_engine.sql`

## ✅ Deployment Status

- ✅ AI Engine created
- ✅ API routes configured
- ✅ Server.js updated
- ✅ Pushed to GitHub (commit 99ab060)
- ✅ Render will auto-deploy

**Backend URL**: https://bizreply-backend.onrender.com

## 🚀 Testing

Once deployed, test with:

```bash
# Health check
curl https://bizreply-backend.onrender.com/health

# Test AI greeting
curl -X POST https://bizreply-backend.onrender.com/api/ai/greeting \
  -H "Content-Type: application/json" \
  -d '{"businessId": "your-id"}'

# Test AI response
curl -X POST https://bizreply-backend.onrender.com/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "your-id",
    "conversationId": "test-id",
    "message": "What products do you have?"
  }'
```

---

**Status**: ✅ Ready to deploy and test!
