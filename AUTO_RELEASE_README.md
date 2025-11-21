# Conversation Auto-Release Feature

## Overview
The auto-release system prevents conversations from being stuck in human mode indefinitely. It automatically releases conversations back to the AI after a period of inactivity.

## Features

### 1. Exit Dialog (Frontend)
When an admin tries to leave a conversation that's in human mode:
- **Dialog prompt** asks if they want to release back to AI
- **Options**: "Keep Human Mode" or "Release to AI"
- Prevents accidental abandonment of conversations

### 2. Auto-Release Cron Job (Backend)
Automatically monitors and releases stale conversations:
- **Default timeout**: 30 minutes of inactivity
- **Check interval**: Every 5 minutes
- **Handback message**: Notifies customer about the transition

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Timeout before auto-release (in minutes)
# Default: 30 minutes
CONVERSATION_TIMEOUT_MINUTES=30

# How often to check for stale conversations (in minutes)
# Default: 5 minutes
AUTO_RELEASE_CHECK_INTERVAL=5
```

## How It Works

### Inactivity Detection
A conversation is considered "stale" when:
1. Mode is set to `human`
2. Last message timestamp (`last_message_at`) is older than the timeout threshold
3. No new messages from either admin or customer

### Auto-Release Process
1. **Detection**: Cron job queries for conversations matching stale criteria
2. **Update**: Changes mode from `human` to `ai`
3. **Cleanup**: Clears `assigned_to` and `assigned_at` fields
4. **Notification**: Sends handback message to customer
5. **Logging**: Records the action for monitoring

### Exit Dialog Flow
1. **User clicks back**: `WillPopScope` intercepts navigation
2. **Check mode**: If conversation is in human mode, show dialog
3. **User choice**:
   - "Keep Human Mode": Navigation proceeds, conversation stays in human mode
   - "Release to AI": Calls API to release, then navigates back
4. **Auto-refresh**: Updates conversation list on return

## Handback Message

Default message sent to customers:
```
Thank you for your patience! Our AI assistant will continue helping you. 
Feel free to request human assistance anytime if needed.
```

## Industry Standards

This implementation follows best practices from:
- **Zendesk**: 15-20 min timeout
- **Intercom**: 20 min timeout  
- **LiveChat**: 30 min timeout (our default)
- **Freshdesk**: 1 hour timeout

## Database Schema

Required fields in `conversations` table:
```sql
mode VARCHAR(20) DEFAULT 'ai'              -- 'ai', 'human', 'paused'
assigned_to UUID REFERENCES users(id)      -- Admin handling the chat
assigned_at TIMESTAMP                       -- When admin took over
last_message_at TIMESTAMP                   -- Last activity timestamp
```

## Monitoring

Check logs for auto-release activity:
```
🔄 Checking for stale human-mode conversations...
Found 2 stale conversation(s)
Releasing conversation abc123 (+1234567890)
✅ Conversation abc123 released to AI
✅ Auto-released 2 conversation(s)
```

## Testing

### Test Exit Dialog
1. Open a conversation
2. Click "Take Over" to enter human mode
3. Press back button
4. Dialog should appear with release options

### Test Auto-Release
1. Take over a conversation
2. Wait for timeout period (or temporarily reduce `CONVERSATION_TIMEOUT_MINUTES` to 1)
3. Check logs for auto-release activity
4. Verify conversation mode changed to `ai` in database

## Future Enhancements

- [ ] Send actual WhatsApp message (currently only saves to DB)
- [ ] Admin notifications when conversations are auto-released
- [ ] Configurable handback message per business
- [ ] Dashboard statistics for auto-released conversations
- [ ] Warning notification before auto-release (5 min warning)
