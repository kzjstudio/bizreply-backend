# Human Handoff & Escalation System

## Overview
Professional customer service escalation system that allows customers to request human assistance and enables business owners to take over conversations from AI.

## Architecture

### 1. Database Schema
**Conversations Table - New Columns:**
- `mode` - VARCHAR(20): Current control mode ('ai', 'human', 'paused')
- `escalation_requested` - BOOLEAN: Customer requested human help
- `escalation_reason` - TEXT: Why customer wants human assistance
- `escalation_requested_at` - TIMESTAMPTZ: When escalation was requested
- `assigned_to` - UUID: User ID of staff handling conversation
- `assigned_at` - TIMESTAMPTZ: When conversation was assigned
- `escalation_count` - INTEGER: Number of times customer escalated

**Businesses Table - New Columns:**
- `notification_email` - VARCHAR(255): Email for escalation alerts
- `notification_phone` - VARCHAR(20): Phone for SMS alerts
- `notification_preferences` - JSONB: Notification channel preferences

### 2. Escalation Detection

**Trigger Phrases:**
The AI automatically detects when customers use phrases like:
- "speak to a human" / "talk to a human"
- "human representative" / "real person"
- "connect me to" / "transfer me to"
- "customer service" / "support representative"
- "agent" / "manager" / "supervisor"
- "not satisfied" / "complaint" / "frustrated"

**Automatic Actions:**
1. Flags conversation with `escalation_requested = true`
2. Captures customer's message as `escalation_reason`
3. Sends acknowledgment: "I understand you'd like to speak with someone from our team..."
4. Notifies business owner (email/push/SMS based on preferences)

### 3. API Endpoints

#### Get Conversations
```
GET /api/conversations/:businessId?status=all&limit=50&offset=0
```
Query params:
- `status`: 'all', 'escalated', 'human', 'ai'
- `limit`: Max results per page
- `offset`: Pagination offset

Returns: Array of conversations with message counts and last message

#### Get Escalated Conversations
```
GET /api/conversations/:businessId/escalated
```
Returns: All conversations awaiting human attention

#### Get Conversation Messages
```
GET /api/conversations/:businessId/:conversationId/messages?limit=100
```
Returns: All messages in chronological order

#### Take Over Conversation
```
POST /api/conversations/:businessId/:conversationId/takeover
Body: { "userId": "uuid" }
```
Actions:
- Sets `mode = 'human'`
- Assigns conversation to user
- Clears escalation flag
- Sends acknowledgment to customer
- Returns updated conversation

#### Release to AI
```
POST /api/conversations/:businessId/:conversationId/release
```
Actions:
- Sets `mode = 'ai'`
- Clears assignment
- AI resumes handling conversation

#### Send Manual Message
```
POST /api/conversations/:businessId/:conversationId/send
Body: { "message": "text", "userId": "uuid" }
```
Actions:
- Sends message via WhatsApp
- Saves with `sent_by = 'manual'`
- Updates conversation timestamp

#### Update Conversation
```
PATCH /api/conversations/:businessId/:conversationId
Body: { "customer_name": "John", "customer_notes": "VIP", "is_archived": false }
```
Allowed fields: `customer_name`, `customer_notes`, `is_archived`

#### Get Stats
```
GET /api/conversations/:businessId/stats
```
Returns:
```json
{
  "total_conversations": 150,
  "pending_escalations": 3,
  "active_human_chats": 5
}
```

### 4. Conversation Modes

**AI Mode (default)**
- AI handles all customer messages
- Automatic responses using business rules
- Product recommendations via semantic search
- Escalation detection active

**Human Mode**
- AI paused, all messages wait for human response
- Business owner sends manual replies via app
- AI does not respond automatically
- Can release back to AI anytime

**Paused Mode**
- AI disabled, no automatic responses
- Useful for temporary pause (e.g., investigating issue)
- No messages sent until resumed

### 5. Notification System (TODO)

**Escalation Alerts:**
When customer requests human help:
1. **Push Notification**: "New escalation request from +1-555-123-4567"
2. **Email**: Subject with conversation context + quick reply link
3. **SMS**: Optional urgent escalation alert

**Implementation Options:**
- **Firebase Cloud Messaging**: Push notifications to Flutter app
- **SendGrid/Mailgun**: Email notifications
- **Twilio**: SMS alerts for urgent escalations

### 6. Flutter UI (TODO)

**Inbox Screen** - `lib/screens/conversations_screen.dart`
Features:
- List of all conversations with filters (All, Escalated, Active, AI)
- Unread count badges
- Last message preview
- Escalation flag indicator 🚨
- Conversation search

**Chat Screen** - `lib/screens/conversation_detail_screen.dart`
Features:
- Full message history
- Manual reply composer
- "Take Over" / "Release to AI" toggle
- Customer notes and context
- Message sent by indicator (AI vs Manual)

## Implementation Status

### ✅ Completed
- [x] Database schema with escalation fields
- [x] Escalation detection in AI service
- [x] Conversation tracking (mode, assignment, escalation status)
- [x] Backend API endpoints for conversation management
- [x] Manual message sending
- [x] Conversation takeover/release logic

### 🚧 In Progress
- [ ] Notification system (push/email/SMS)
- [ ] Flutter inbox UI
- [ ] Flutter chat screen with manual reply
- [ ] Real-time updates via WebSocket/polling

### 📋 Pending
- [ ] Multi-user support (team members)
- [ ] Conversation assignment routing
- [ ] Canned responses for common inquiries
- [ ] Conversation analytics dashboard

## Usage Example

### Customer Flow:
1. Customer: "Do you have any ceiling fans?"
2. AI: "Yes! We have the Modern Ceiling Fan ($89.99)..."
3. Customer: "Can I speak to a human about installation?"
4. AI: "I understand you'd like to speak with someone from our team. I've notified them..."
   - Conversation flagged for escalation
   - Business owner receives notification

### Business Owner Flow:
1. Receives push notification: "Escalation request from +1-555-123-4567"
2. Opens app → Conversations → Sees 🚨 indicator
3. Taps conversation → Reads full context
4. Clicks "Take Over" → Mode switches to human
5. Types manual reply: "Hi! I'd be happy to help with installation..."
6. Continues conversation until resolved
7. Clicks "Release to AI" when done

## Security Considerations

- All endpoints require authentication (business owner must own the businessId)
- Rate limiting on manual message sending (prevent spam)
- Conversation data encrypted at rest
- Audit log of all takeovers and manual messages

## Performance Optimization

- Conversations paginated (50 per page default)
- Message history loaded on-demand
- Escalation view indexed for fast queries
- Real-time updates via efficient polling/WebSocket

## Testing

### Manual Testing:
```bash
# Send test message requesting human
curl -X POST https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json \
  -u $TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN \
  -d "From=whatsapp:+1234567890" \
  -d "To=whatsapp:$BUSINESS_WHATSAPP" \
  -d "Body=Can I speak to a human representative?"

# Check escalation flagged
curl https://bizreply-backend.onrender.com/api/conversations/$BUSINESS_ID/escalated

# Take over conversation
curl -X POST https://bizreply-backend.onrender.com/api/conversations/$BUSINESS_ID/$CONVERSATION_ID/takeover \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'

# Send manual message
curl -X POST https://bizreply-backend.onrender.com/api/conversations/$BUSINESS_ID/$CONVERSATION_ID/send \
  -H "Content-Type: application/json" \
  -d '{"message": "Hi! How can I help with installation?", "userId": "user-uuid"}'
```

## Next Steps

1. **Run Database Migration:**
   ```bash
   # Connect to Supabase SQL editor
   # Run: bizreply-backend/database/add_conversation_escalation.sql
   ```

2. **Test Escalation Detection:**
   - Send WhatsApp message: "I want to speak to a human"
   - Verify conversation flagged in Supabase
   - Check logs for escalation detection

3. **Build Flutter Inbox Screen:**
   - Create ConversationsScreen widget
   - Fetch conversations from API
   - Display with escalation indicators
   - Add navigation to detail view

4. **Implement Notifications:**
   - Setup Firebase Cloud Messaging
   - Configure email provider (SendGrid)
   - Add notification preferences to Business settings

## Support

For questions or issues with the human handoff system:
- Check Supabase logs for conversation state changes
- Review backend logs for escalation detection
- Verify WhatsApp message delivery via Twilio console
