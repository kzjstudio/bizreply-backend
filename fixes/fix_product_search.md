# Fix: Product Search Returning 0 Results

## Problem
The search_similar_products function returns 0 products even though:
- Products have embeddings (15 products synced successfully)
- The function executes without errors
- Logs show "📦 Found 0 relevant products"

## Root Cause
Looking at the OpenAI embedding request log:
```javascript
input: 'Sure! We have a variety of home items available for under $50, including kitchen accessories, decorative cushions, and small storage solutions... Show me items under $50... What items do you have under $50'
```

The `conversationContext` parameter being passed to `getRecommendations()` includes:
1. Entire conversation history (8 messages)
2. Previous AI responses (generic product descriptions)
3. Repeated queries

This creates a noisy embedding that doesn't match product embeddings well.

## Solution
Modify `aiEngine.js` to pass only the current customer message for product search, not the entire conversation history.

### Change in aiEngine.js (line ~190):

**BEFORE:**
```javascript
// 3. Get relevant products based on context
const conversationContext = history
  .map(msg => msg.message_text)
  .join(' ') + ' ' + customerMessage;

const products = await this.getRelevantProducts(
  businessId,
  conversationContext,
  5
);
```

**AFTER:**
```javascript
// 3. Get relevant products based on current message
// Use only the customer's current query for better semantic matching
const products = await this.getRelevantProducts(
  businessId,
  customerMessage, // Only current message, not full history
  5
);
```

## Why This Works
1. Product embeddings are created from: `Product: [name]. Category: [category]. Price: $[price]. Description: [description]`
2. Current message is: "What items do you have under $50"
3. These should have good semantic similarity (items, products, price range)
4. Full conversation history adds noise and dilutes the similarity score below the 0.6 threshold

## Additional Debugging
If this doesn't work, also check:
1. Verify match_threshold in getRecommendations (currently 0.6, might need 0.5)
2. Test search_similar_products function directly in Supabase SQL editor
3. Check if embedding dimensions match (1536 for text-embedding-3-small)
