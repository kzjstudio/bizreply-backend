# Next Steps - Twilio Integration

## ✅ Completed
- [x] Twilio SDK installed
- [x] Backend code updated to support both Meta and Twilio
- [x] Changes pushed to GitHub
- [x] Render deployment triggered

## 🔄 In Progress - Add Twilio Credentials to Render

### Step 1: Add Environment Variables

1. Go to Render Dashboard: https://dashboard.render.com
2. Select your `bizreply-backend` service
3. Go to **Environment** tab
4. Click **Add Environment Variable** for each:

```
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_NUMBER=+14155238886
```

5. Click **Save Changes**
6. Wait for automatic redeploy (2-3 minutes)
7. Check logs to verify: "Twilio WhatsApp client initialized"

## 📋 Next Steps

### Step 2: Configure Twilio Webhook

1. Go to Twilio Console: https://console.twilio.com
2. Navigate to **Messaging** → **Try it out** → **Send a WhatsApp message**
3. Scroll to **Sandbox Configuration** section
4. Find **"When a message comes in"** field
5. Enter your Render URL:
   ```
   https://bizreply-backend.onrender.com/webhook
   ```
   *(Replace with your actual Render app URL)*
6. Set method to: **POST**
7. Click **Save**

### Step 3: Test Sandbox

1. From your WhatsApp, send to: **+1 415 523 8886**
2. Send the join message: **"join [code]"**
   - Find your specific join code in Twilio sandbox settings
3. Wait for confirmation from Twilio
4. Send test message: **"Hello, I need help"**
5. You should get an AI-generated response!

### Step 4: Verify Everything Works

**Check Render Logs:**
1. Go to Render dashboard → Logs tab
2. Look for:
   ```
   🔵 Detected Twilio webhook
   📱 Message from +1234567890: Hello, I need help
   ✅ Replied to +1234567890 successfully
   ```

**Check Firebase:**
1. Go to Firebase Console
2. Navigate to Firestore Database
3. Look in `businesses/default/messages` collection
4. You should see incoming and outgoing messages

**Check Twilio:**
1. In Twilio console, go to **Messaging** → **Logs**
2. Verify messages sent successfully

## 🐛 Troubleshooting

**Issue: "Twilio WhatsApp client initialized" not in logs**
- Solution: Verify environment variables are correct in Render
- Make sure WHATSAPP_PROVIDER=twilio (no quotes, exactly)
- Redeploy if needed

**Issue: Not receiving webhook**
- Solution: Check webhook URL is exactly right (including /webhook)
- Verify Render app is running (green status)
- Test URL: `curl https://your-app.onrender.com/webhook`

**Issue: Join command not working**
- Solution: Make sure you use the exact join code from Twilio
- Try again - sometimes there's a delay
- Check phone number format: +1 415 523 8886

**Issue: AI not responding**
- Solution: Check Render logs for errors
- Verify OPENAI_API_KEY is still set in Render
- Check Firebase credentials are correct

## 📊 What's Changed

**Backend now supports TWO providers:**

**Meta (existing):**
- Uses Facebook Graph API
- Your phoneNumberId: 859278693937509
- For production customers later

**Twilio (new):**
- Uses Twilio API
- Sandbox number: +14155238886
- For testing right now

**Code automatically detects which provider:**
- Checks webhook format
- Routes to correct handler
- Uses correct API for sending

## 🎯 After Testing Successfully

1. **Upgrade Twilio** (optional, only when ready):
   - Switch to pay-as-you-go
   - Request WhatsApp approval (1-3 days)
   - Buy real phone numbers ($1.50/month each)

2. **Enable Firebase Auth**:
   - Go to Firebase Console → Authentication
   - Enable Email/Password provider
   - Test Flutter app signup/login

3. **Launch MVP**:
   - Test complete flow
   - Onboard first test customers
   - Start collecting feedback

## 💡 Current Status

- ✅ Backend code ready
- ⏳ Waiting for you to add Twilio credentials to Render
- ⏳ Then configure webhook in Twilio
- ⏳ Then test!

Let me know when you've added the environment variables to Render and I'll help you test!
