# Instagram DM AI Integration Guide

## Overview
Enable AI-powered automatic responses to Instagram Direct Messages using Meta Graph API. This integration:
- Receives incoming IG DMs via Meta Webhook (Messaging scope)
- Verifies X-Hub-Signature-256 for security
- Persists conversations and messages in Supabase
- Generates AI responses (via existing `aiEngine`) respecting usage limits
- Replies back through the Messenger send API (recipient PSID)

---
## Prerequisites
1. Instagram Business Account connected to a Facebook Page
2. Meta App with the following permissions approved (standard dev → live process):
   - `pages_read_engagement`
   - `pages_manage_metadata`
   - `pages_messaging`
   - `instagram_manage_messages`
   - `instagram_basic`
3. Long-lived Page Access Token (contains instagram scopes)
4. App Secret
5. Webhook subscription configured for the Page (Instagram and messaging fields)

---
## Environment Variables (.env)
```
INSTAGRAM_VERIFY_TOKEN='bizreply_ig_verify_2025'
INSTAGRAM_APP_SECRET=your_meta_app_secret
INSTAGRAM_PAGE_ACCESS_TOKEN=your_long_lived_page_token
INSTAGRAM_IG_BUSINESS_ID=your_instagram_business_account_id
META_GRAPH_API_VERSION='v18.0'
IG_DEFAULT_BUSINESS_ID=uuid_of_bizreply_business_record
INSTAGRAM_APP_ID=your_meta_app_id
INSTAGRAM_REDIRECT_URI=https://kzjinnovations.com/api/instagram/callback
INSTAGRAM_SCOPES=pages_show_list,pages_read_engagement,pages_read_user_content,instagram_basic,instagram_manage_messages,business_management
```
Set `IG_DEFAULT_BUSINESS_ID` if all IG traffic maps to one business. Later you can map PSID → business dynamically.

---
## Architecture Flow
```
User DM → Meta Webhook (POST /api/instagram/webhook)
          ↳ Signature Verified (X-Hub-Signature-256)
          ↳ Extract sender.id & message.text
          ↳ Get/Create Conversation (Supabase)
          ↳ Store inbound message
          ↳ AI Engine generateResponse()
          ↳ Send reply via Graph: POST /me/messages
          ↳ Store outbound message
```

---
## Files Added
- `services/instagram.service.js`: Core logic (verify signature, process DM, send reply)
- `routes/instagram.js`: Webhook route + verify endpoint + status
- `src/server.js`: Registered `app.use('/api/instagram', instagramRoutes);`
- `.env`: Added Instagram configuration variables

---
## Webhook Verification
Meta sends a GET request:
```
GET /api/instagram/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=12345
```
If `hub.verify_token` matches `INSTAGRAM_VERIFY_TOKEN` respond with the `hub.challenge`.

---
## Webhook Security
Each POST includes `X-Hub-Signature-256: sha256=...` header.
We compute:
```
expected = 'sha256=' + HMAC_SHA256(APP_SECRET, raw_body)
constant_time_compare(expected, header)
```
Reject with 401 on mismatch (allowed bypass if APP_SECRET unset for early dev).

---
## Incoming Payload (Simplified Example)
```
{
  "object": "page",
  "entry": [
    {
      "id": "<page_id>",
      "time": 1700000000,
      "messaging": [
        {
          "sender": { "id": "<user_psid>" },
          "recipient": { "id": "<page_id>" },
          "timestamp": 1700000001,
          "message": {
            "mid": "m_abc123",
            "text": "Hi, do you have blue sneakers?"
          }
        }
      ]
    }
  ]
}
```

---
## Reply API
Send responses to user PSID via:
```
POST https://graph.facebook.com/v18.0/me/messages
Authorization: Bearer <INSTAGRAM_PAGE_ACCESS_TOKEN>
Body:
{
  "recipient": { "id": "<user_psid>" },
  "message": { "text": "Your reply text" }
}
```

---
## Supabase Schema Notes
Expected existing tables:
- `conversations`: add nullable column `instagram_user_id` (if not present yet)
- `messages`: stores each inbound/outbound message

If `instagram_user_id` column missing, run migration:
```sql
ALTER TABLE conversations ADD COLUMN instagram_user_id text;
CREATE INDEX IF NOT EXISTS conversations_instagram_user_idx ON conversations(instagram_user_id);
```

---
## Error Handling & Fallback
On AI generation or send error:
- Log error
- Attempt fallback message: "I'm having trouble right now. A team member will follow up shortly."

---
## Local Testing Steps
1. Expose server with tunneling (e.g. `ngrok http 3000`).
2. Set webhook URL in Meta App dashboard: `https://<ngrok-domain>/api/instagram/webhook`.
3. Subscribe to Page events: messages.
4. Send DM to connected IG business account from another account.
5. Observe logs.

Curl verification test:
```bash
curl "http://localhost:3000/api/instagram/status"
```

Manual send test (requires a captured PSID):
```bash
curl -X POST "https://graph.facebook.com/v18.0/me/messages" \
  -H "Authorization: Bearer $INSTAGRAM_PAGE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient":{"id":"USER_PSID"},"message":{"text":"Test reply"}}'
```

---
## Production Checklist
- [ ] Long-lived Page token stored securely
- [ ] App moved to Live mode with required permissions
- [ ] Webhook subscription verified (HTTP 200)
- [ ] Signature verification enabled (APP_SECRET set)
- [ ] Rate limiting (already provided by server)
- [ ] Fallback messaging tested
- [ ] Observability: logs & error tracking (Sentry optional)

---
## Future Enhancements
- Carousel / media replies (images, product cards)
- Quick reply buttons for guided flows
- Multi-business mapping by PSID → business table
- Intent classification to route urgent messages to humans
- Analytics dashboard for IG conversation metrics
- Full OAuth page selection caching & encryption of tokens
- Automatic token refresh cron
- Comment ingestion & product matching

---
## OAuth Connect Flow (New)
1. Frontend requests login URL:
  `GET /api/instagram/connect?business_id=<uuid>` → returns `{ login_url, state }`.
2. Open `login_url` in webview or browser; user grants required scopes.
3. Meta redirects to `INSTAGRAM_REDIRECT_URI` with `code` & `state`.
4. Backend `GET /api/instagram/callback` exchanges code → short-lived → long-lived user token, fetches pages, enriches with Instagram Business Account IDs, returns JSON list.
5. Frontend POSTs selection:
  `POST /api/instagram/select` body:
  ```json
  {
    "business_id": "<uuid>",
    "page_id": "<page_id>",
    "page_name": "My Page",
    "page_access_token": "<page_access_token>",
    "instagram_business_account_id": "<ig_business_id>"
  }
  ```
6. Backend persists record in `instagram_accounts` and subscribes the page to `messages,feed` events.

Security Notes:
- `state` is single‑use & expires after 10 minutes.
- Tokens currently stored plaintext → encrypt before production launch.
- Only send back pages with `instagram_business_account_id` for simplified UI; full list also provided if needed.

---
## Troubleshooting
| Issue | Cause | Fix |
|-------|-------|-----|
| 403 webhook verify | Wrong verify token | Match `INSTAGRAM_VERIFY_TOKEN` in App config |
| 401 send API | Expired token | Regenerate long-lived Page token |
| No messages received | Missing messaging subscription | Add Messages under Webhooks for Page |
| Signature invalid | Misconfigured App Secret | Ensure `INSTAGRAM_APP_SECRET` matches dashboard |
| AI disabled logs | Business `ai_enabled=false` | Toggle flag in DB |

---
**Status:** Instagram DM integration scaffold complete – configure credentials to activate.
