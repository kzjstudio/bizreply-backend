# BizReply Backend - WhatsApp Business AI Reply Server

A Node.js backend server that handles WhatsApp Business API webhooks, processes messages with AI, and manages business rules.

## 🚀 Features

- ✅ WhatsApp Business API webhook integration
- ✅ AI-powered response generation (OpenAI GPT-4/3.5)
- ✅ Firebase Firestore database for data storage
- ✅ Multi-business support
- ✅ Conversation history tracking
- ✅ Business rules and templates management
- ✅ Rate limiting and security features

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **WhatsApp Business API Account** ([Sign up here](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started))
3. **Firebase Project** ([Create one here](https://console.firebase.google.com/))
4. **OpenAI API Key** (optional, for AI responses) ([Get one here](https://platform.openai.com/api-keys))

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

### 5. Start the Server

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:3000`

## 🔗 Configure WhatsApp Webhook

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

## 📊 Firestore Database Structure

```
businesses/
  {businessId}/
    - name: string
    - phoneNumberId: string
    - rules: object
      - businessName: string
      - businessHours: string
      - description: string
      - specialInstructions: string
    - templates: object
      - priceList: string
      - location: string
      - etc...
    - createdAt: timestamp
    - updatedAt: timestamp

messages/
  {messageId}/
    - businessId: string
    - from: string (phone number)
    - to: string (phone number)
    - messageText: string
    - timestamp: timestamp
    - direction: string (incoming/outgoing)
    - type: string (text/image/etc)
    - createdAt: timestamp
```

## 🧪 Testing

### Test webhook verification:
```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_VERIFY_TOKEN&hub.challenge=test123"
```

### Test health endpoint:
```bash
curl http://localhost:3000/health
```

### Create a test business:
```bash
curl -X POST http://localhost:3000/api/business \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Business",
    "phoneNumberId": "YOUR_PHONE_NUMBER_ID",
    "rules": {
      "businessName": "My Coffee Shop",
      "businessHours": "Mon-Fri 9AM-6PM",
      "description": "We sell amazing coffee"
    },
    "templates": {
      "priceList": "Coffee: $5, Tea: $3, Cake: $7"
    }
  }'
```

## 📡 API Endpoints

### Webhook
- `GET /webhook` - WhatsApp webhook verification
- `POST /webhook` - Receive WhatsApp messages

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

## 📝 Next Steps

1. ✅ Deploy backend to cloud platform
2. ✅ Configure WhatsApp webhook with public URL
3. ✅ Get OpenAI API key for AI responses
4. ✅ Build Flutter admin dashboard
5. ✅ Test end-to-end message flow

## 📞 Support

For issues or questions, check the logs in the console for detailed error messages.
