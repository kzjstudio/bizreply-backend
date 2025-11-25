# BizReply Backend - Multi-Platform AI Customer Service Agent

A Node.js backend server that handles WhatsApp, Facebook Messenger, and Instagram webhooks, processes messages with AI, and manages business rules for automatic customer service responses.

## 🚀 Features

- ✅ WhatsApp Business API webhook integration
- ✅ Facebook Messenger webhook integration
- ✅ Instagram Direct Messages webhook integration
- ✅ Facebook Page comments auto-reply
- ✅ Instagram comments auto-reply
- ✅ AI-powered response generation (OpenAI GPT-4/3.5)
- ✅ Firebase Firestore database for data storage
- ✅ Multi-business support
- ✅ Conversation history tracking
- ✅ Business rules and templates management
- ✅ Rate limiting and security features

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **WhatsApp Business API Account** ([Sign up here](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started))
3. **Facebook Page** with Messenger enabled ([Create one here](https://www.facebook.com/pages/create))
4. **Instagram Business Account** connected to Facebook Page
5. **Firebase Project** ([Create one here](https://console.firebase.google.com/))
6. **OpenAI API Key** (optional, for AI responses) ([Get one here](https://platform.openai.com/api-keys))

## 🛠️ Setup Instructions

### 1. Install Dependencies

```bash
cd bizreply-backend
npm install
```

### 2. Configure Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the downloaded JSON file as `firebase-service-account.json` in the backend root directory

### 3. Set Up Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in `.env`:
   ```env
   PORT=3000
   
   # WhatsApp Business API (from Meta for Developers)
   WHATSAPP_API_TOKEN=your_access_token
   WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
   WEBHOOK_VERIFY_TOKEN=any_random_string_you_choose
   
   # AI API (optional - get from OpenAI)
   OPENAI_API_KEY=sk-your_openai_api_key
   
   # Firebase
   FIREBASE_PROJECT_ID=your_firebase_project_id
   FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   ```

### 4. Get WhatsApp API Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Create an app or select existing one
3. Add **WhatsApp** product
4. Get your:
   - **Access Token** (from API Setup)
   - **Phone Number ID** (from API Setup)
   - Create a **Webhook Verify Token** (any random string)

### 5. Get Facebook & Instagram API Credentials

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. In your app, add the **Messenger** and **Instagram** products
3. Connect your **Facebook Page** to the app
4. Connect your **Instagram Business Account** to the Facebook Page
5. Get your:
   - **Page Access Token** (from Messenger → Settings → Access Tokens)
   - **Facebook Page ID** (from Page Settings → About)
   - **Instagram Business Account ID** (from Instagram → Basic Display)
6. Configure webhook subscriptions:
   - **Messenger**: `messages`, `messaging_postbacks`, `message_deliveries`, `message_reads`
   - **Instagram**: `messages`, `comments`, `mentions`
   - **Page**: `feed` (for comment auto-replies)

### 6. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## 🔗 Configure Webhooks

### WhatsApp Webhook

1. **Deploy your backend** to a public server with HTTPS (required by Meta):
   - Render.com
   - Railway.app
   - Heroku
   - Google Cloud Run
   - AWS

2. **Set up webhook in Meta:**
   - Go to WhatsApp → Configuration
   - Click **Edit** next to Webhook
   - Enter:
     - **Callback URL**: `https://your-domain.com/webhook`
     - **Verify Token**: The same token you set in `.env`
   - Click **Verify and Save**
   - Subscribe to webhook fields: `messages`

### Facebook Messenger Webhook

1. In Meta Developer Portal, go to **Messenger** → **Settings**
2. Under **Webhooks**, click **Add Callback URL**
3. Enter:
   - **Callback URL**: `https://your-domain.com/webhook/facebook`
   - **Verify Token**: The same token you set in `.env`
4. Subscribe to webhook fields:
   - `messages` - Receive messages
   - `messaging_postbacks` - Button clicks
   - `message_deliveries` - Delivery confirmations
   - `message_reads` - Read receipts

### Instagram Webhook

1. In Meta Developer Portal, go to **Instagram** → **Webhooks**
2. Click **Add Callback URL**
3. Enter:
   - **Callback URL**: `https://your-domain.com/webhook/instagram`
   - **Verify Token**: The same token you set in `.env`
4. Subscribe to webhook fields:
   - `messages` - Direct messages
   - `comments` - Comments on your posts
   - `mentions` - When someone mentions your account

### Facebook Page Comments Webhook

1. In Meta Developer Portal, go to your **App** → **Webhooks**
2. Select **Page** as the object
3. Enter your webhook URL: `https://your-domain.com/webhook/facebook`
4. Subscribe to:
   - `feed` - Page feed events (including comments)

## 📊 Firestore Database Structure

```
businesses/
  {businessId}/
    - name: string
    - phoneNumberId: string (WhatsApp)
    - facebookPageId: string (Facebook)
    - instagramAccountId: string (Instagram)
    - facebookPageAccessToken: string (optional, per-business token)
    - rules: object
      - businessName: string
      - businessHours: string
      - description: string
      - specialInstructions: string
    - templates: object
      - priceList: string
      - location: string
      - etc...
    - settings: object
      - autoReplyComments: boolean (enable/disable comment auto-replies)
    - createdAt: timestamp
    - updatedAt: timestamp

messages/
  {messageId}/
    - businessId: string
    - from: string (sender ID)
    - to: string (recipient ID)
    - messageText: string
    - timestamp: timestamp
    - direction: string (incoming/outgoing)
    - type: string (text/comment/image/etc)
    - platform: string (whatsapp/facebook/instagram)
    - postId: string (for comments)
    - mediaId: string (for Instagram comments)
    - createdAt: timestamp
```

## 🧪 Testing

### Test WhatsApp webhook verification:
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

### Test Facebook webhook verification:
```bash
curl "http://localhost:3000/webhook/facebook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

### Test Instagram webhook verification:
```bash
curl "http://localhost:3000/webhook/instagram?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

### Test health endpoint:
```bash
curl http://localhost:3000/health
```

### Create a test business (with all platforms):
```bash
curl -X POST http://localhost:3000/api/business \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Business",
    "phoneNumberId": "YOUR_WHATSAPP_PHONE_NUMBER_ID",
    "facebookPageId": "YOUR_FACEBOOK_PAGE_ID",
    "instagramAccountId": "YOUR_INSTAGRAM_ACCOUNT_ID",
    "rules": {
      "businessName": "My Coffee Shop",
      "businessHours": "Mon-Fri 9AM-6PM",
      "description": "We sell amazing coffee"
    },
    "templates": {
      "priceList": "Coffee: $5, Tea: $3, Cake: $7"
    },
    "settings": {
      "autoReplyComments": true
    }
  }'
```

## 📡 API Endpoints

### Webhooks
- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - Receive WhatsApp messages
- `GET /webhook/facebook` - Facebook webhook verification
- `POST /webhook/facebook` - Receive Facebook Messenger messages and page comments
- `GET /webhook/instagram` - Instagram webhook verification
- `POST /webhook/instagram` - Receive Instagram Direct messages and comments

### Business Management
- `POST /api/business` - Create new business
- `GET /api/business/:businessId` - Get business details
- `PUT /api/business/:businessId` - Update business
- `DELETE /api/business/:businessId` - Delete business
- `GET /api/business` - List all businesses

### Health Check
- `GET /health` - Server health check

## 🔐 Security Features

- Helmet.js for security headers
- CORS enabled
- Rate limiting (100 requests per 15 minutes per IP)
- Environment variable validation
- Webhook verification token

## 🐛 Troubleshooting

**Firebase Connection Issues:**
- Ensure `firebase-service-account.json` path is correct
- Verify Firebase project ID matches
- Check Firestore is enabled in Firebase Console

**WhatsApp Webhook Not Working:**
- Ensure server has HTTPS (Meta requires it)
- Verify webhook verify token matches in Meta and `.env`
- Check webhook is subscribed to `messages` field
- View logs for incoming requests

**AI Responses Not Working:**
- Check OpenAI API key is valid
- Verify you have credits in OpenAI account
- Server will use fallback responses if AI fails

**Facebook/Instagram Not Working:**
- Ensure your Facebook Page is connected to the app
- For Instagram, ensure your Instagram Business Account is connected to your Facebook Page
- Verify page access token has the required permissions
- Check that webhooks are subscribed to the correct fields
- For Instagram DMs, ensure the Instagram account has Instagram Messaging API enabled
- For comment auto-replies, ensure `settings.autoReplyComments` is set to `true` in the business config

## 📱 Platform-Specific Notes

### WhatsApp
- Messages are sent via the WhatsApp Cloud API
- Requires a verified WhatsApp Business Account
- Phone numbers must be in international format (e.g., +1234567890)

### Facebook Messenger
- Uses the Facebook Send API for messaging
- Supports text messages, attachments, and quick replies
- Page must be published and have Messenger enabled
- Comments on page posts can trigger auto-replies

### Instagram
- Uses the Instagram Messaging API (requires Instagram Business Account)
- Direct messages work similarly to Facebook Messenger
- Comment replies are posted publicly on the post
- Story mentions and replies can be detected but require custom handling

## 📝 Next Steps

1. ✅ Deploy backend to cloud platform
2. ✅ Configure WhatsApp webhook with public URL
3. ✅ Configure Facebook webhook with public URL
4. ✅ Configure Instagram webhook with public URL
5. ✅ Get OpenAI API key for AI responses
6. ✅ Build Flutter admin dashboard
7. ✅ Test end-to-end message flow on all platforms
8. 🔜 Add TikTok integration (coming soon)

## 📞 Support

For issues or questions, check the logs in the console for detailed error messages.
