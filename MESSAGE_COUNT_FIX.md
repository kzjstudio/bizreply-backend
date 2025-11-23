# Message Count Fix

## Problem
The dashboard always shows "0 messages" even after AI processes customer messages. The `message_count` field in the `businesses` table is never incremented.

## Root Cause
**Backend does not increment the message counter** when processing WhatsApp messages. 

### Investigation Results:
1. ✅ **Frontend**: Correctly displays `business.messageCount` from database
2. ✅ **Database**: `message_count` field exists in `businesses` table
3. ✅ **Initialization**: Field is set to `0` when business is created
4. ❌ **Increment Logic**: **MISSING** - No code increments the counter when messages are processed

### Code Locations Checked:
- `src/controllers/whatsapp.controller.js` - Processes incoming messages, calls AI, but doesn't increment counter
- `services/aiEngine.js` - Generates AI responses, but doesn't increment counter
- `services/supabase.service.js` - Saves messages to database, but doesn't increment counter
- Searched for: `update.*message_count`, `message_count.*+`, `increment.*message` - **No matches found**

## Solution

### 1. Create SQL Function
Added `database/increment_message_count.sql`:
```sql
CREATE OR REPLACE FUNCTION increment_message_count(business_id_param UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE businesses
  SET message_count = COALESCE(message_count, 0) + 1
  WHERE id = business_id_param;
END;
$$;
```

### 2. Update AI Engine
Modified `services/aiEngine.js` in `generateResponse()` function (after line 745):
- Added call to `increment_message_count` RPC function
- Placed after successful AI response generation
- Includes error handling (doesn't fail request if counter update fails)
- Logs success with emoji: `📊 Message count incremented for business {id}`

### 3. Increment Location
Counter is incremented in `aiEngine.generateResponse()` because:
- ✅ Called by both Twilio and Meta webhook handlers
- ✅ Only increments after successful AI response (not for escalations, paused conversations, etc.)
- ✅ Runs once per customer message (not multiple times)
- ✅ Centralized location - single source of truth

### Flow:
```
Customer sends WhatsApp message
  ↓
Webhook receives message → whatsapp.controller.js
  ↓
AI generates response → aiEngine.generateResponse()
  ↓
Track product recommendations (line 745)
  ↓
**INCREMENT MESSAGE COUNT** ← NEW (line 750)
  ↓
Audit response quality (line 762)
  ↓
Return response to customer
```

## Deployment Steps

### Step 1: Run SQL in Supabase
1. Go to Supabase Dashboard → SQL Editor
2. Copy content from `database/increment_message_count.sql`
3. Click "Run" to create the function

### Step 2: Deploy Backend
Backend code changes are already made in `services/aiEngine.js`. Deploy by:
```bash
git add .
git commit -m "Add message count increment functionality"
git push origin main
```
Render will auto-deploy the changes.

### Step 3: Test
Run the test script:
```bash
cd bizreply-backend
.\test-message-count.ps1
```

This will:
- Create the SQL function in Supabase
- Get your active business
- Test incrementing the counter manually
- Verify the count increased

### Step 4: Test with Real Message
1. Send a WhatsApp message to your Twilio AI number
2. Wait for AI to respond
3. Refresh your Flutter app dashboard
4. Verify message count shows "1" (or incremented by 1)

## Testing
Use `test-message-count.ps1` to verify the SQL function works before testing with real messages.

## Notes
- Counter only increments for AI-generated responses (not escalations or paused conversations)
- Uses `COALESCE(message_count, 0) + 1` to handle NULL values safely
- Error handling ensures message processing doesn't fail if counter update fails
- Logs clearly show when counter is incremented for debugging
- SQL function has proper permissions for authenticated and service_role users

## Expected Behavior After Fix
- Dashboard shows "0 Messages Handled by AI" initially
- Each customer message that AI responds to increments the counter
- Dashboard refreshes to show updated count
- Works for both Twilio and Meta WhatsApp providers
- Counter persists across app restarts (stored in database)
