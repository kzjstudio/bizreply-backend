# 360Dialog Setup Guide for BizReply AI

## Overview
360Dialog is a WhatsApp Business Solution Provider (BSP) that provides official WhatsApp Business API access. They offer a client hub portal for easy management and competitive pricing.

## Prerequisites
- **Business Email**: While they may accept Gmail, having a business email (admin@yourdomain.com) significantly improves approval chances
- **Business Information**: Company name, address, website (optional but helpful)
- **Phone Number**: For verification

## IMPORTANT: Choose the Right Product

360Dialog has TWO different products:

1. **Partner Platform** ($500/month) - For resellers who provide WhatsApp to clients ❌ NOT for you
2. **WhatsApp API** (Pay-as-you-go) - For direct usage ✅ THIS is what you need

## Step-by-Step Setup

### 1. Get Direct WhatsApp API Access (NOT Partner Platform)

**CORRECT SIGNUP LINK:**
1. Go to: https://start.360dialog.com/connect
   - OR go to: https://www.360dialog.com/whatsapp-api and click "Get Started"
2. Select **"WhatsApp API"** product (NOT "Partner Platform")
3. Fill in registration form:
   - **Email**: Use business email if possible (admin@yourdomain.com)
   - If using Gmail: Use your most professional-looking one
   - **Company Name**: Your business name (e.g., "BizReply AI")
   - **Use Case**: "Customer support automation" or "Business messaging"
   - **Password**: Strong password
4. Verify your email address
5. Complete account setup

### 2. Create a Partner Channel (WhatsApp Integration)
1. Log into 360Dialog Hub: https://hub.360dialog.com
2. Navigate to **"Channels"** or **"WhatsApp Business API"**
3. Click **"Add Channel"** or **"Get Started"**
4. Select **"WhatsApp Business API"**

### 3. Connect WhatsApp Number
Two options:

#### Option A: Migrate Existing WhatsApp Business Number
- If you have WhatsApp Business app with a number
- 360Dialog will guide you through migration
- **Note**: Number will be moved from app to API (can't use app anymore)

#### Option B: Get New WhatsApp Number (Recommended for SaaS)
1. Purchase new phone numbers from 360Dialog
2. They offer numbers in multiple countries
3. Costs: ~€1-2 per month per number
4. Select your country and purchase

### 4. Business Verification
1. **Facebook Business Manager Account**:
   - Go to: https://business.facebook.com
   - Create account if you don't have one
   - Add your business information

2. **Submit Business Verification** (Required by Meta):
   - Legal business name
   - Business address
   - Business phone number
   - Business website (if available)
   - Business documents (may be required):
     - Business license/registration
     - Tax ID
     - Utility bill showing business address

3. **Approval Timeline**:
   - Initial account setup: Instant
   - Business verification: 1-5 business days
   - Can start testing immediately with sandbox

### 5. Get API Credentials from 360Dialog

Once approved, get your credentials:

1. In 360Dialog Hub, go to your WhatsApp channel
2. Find **"API Key"** section
3. Copy your **API Key** (keep secure!)
4. Note your **WhatsApp Phone Number ID**
5. Get your **WhatsApp Business Account ID (WABA ID)**

### 6. Configure BizReply Backend

You'll need to update your backend to support 360Dialog's API:

**Environment Variables to Add:**
```
WHATSAPP_PROVIDER=360dialog
360DIALOG_API_KEY=your_api_key_here
360DIALOG_PARTNER_ID=your_partner_id
```

### 7. Set Up Webhook with 360Dialog

1. In 360Dialog Hub, go to **Webhooks** section
2. Add your Render backend URL:
   ```
   https://your-app.onrender.com/webhook
   ```
3. Set webhook verification token (same as your current VERIFY_TOKEN)
4. Subscribe to message events:
   - `messages`
   - `message_status`

### 8. Testing

**Sandbox Testing (Before Approval):**
1. 360Dialog provides test numbers
2. Send test messages to verify integration
3. Test AI responses and message storage

**Production Testing (After Approval):**
1. Send message from your phone to your WhatsApp Business number
2. Verify AI responds
3. Check Firebase for stored messages
4. Test from Flutter dashboard

## Pricing - WhatsApp API (Direct Usage)

**360Dialog WhatsApp API Costs:**
- **Account Setup**: FREE (no monthly fee)
- **WhatsApp Business Account (WABA)**: Meta charges $0-5/month depending on verification
- **Phone Numbers**: 
  - You provide your own number: FREE
  - Or buy from 360Dialog: ~€1-2 per month per number
- **Messages**: 
  - **Meta's Pricing** (360Dialog passes through, no markup):
    - First 1,000 conversations/month: FREE
    - After that: $0.005-0.10 per conversation (varies by country)
    - US/Europe: ~$0.005-0.02 per conversation
- **360Dialog Service Fee**: Small percentage on top of Meta's fees (typically 10-20%)

**Example Total Cost:**
- 0 messages: $0/month
- 1,000 messages: $0/month (free tier)
- 5,000 messages: ~$5-15/month
- 10,000 messages: ~$15-30/month

**Billing:**
- Pay-as-you-go (no monthly commitment)
- Prepaid credits system
- Add credits to your 360Dialog account
- Charged per message sent

**VS Partner Platform ($500/month):**
- Partner Platform is for companies reselling WhatsApp to 100+ clients
- You don't need this - use WhatsApp API instead

## Tips for Approval

1. **Email Domain**: 
   - If Gmail rejected before, try:
   - Use most professional Gmail (firstname.lastname@gmail.com)
   - Or get temporary business email (Zoho Mail free tier)

2. **Business Profile**:
   - Fill out completely
   - Add business description
   - Add business address (can be home address)
   - Add phone number
   - Add website if you have one (not required)

3. **Facebook Business Manager**:
   - Create business manager account first
   - Verify it before applying
   - Link it to 360Dialog

4. **Start with One Number**:
   - Test with single number first
   - Scale to multiple numbers after validation

## Common Issues and Solutions

**Issue: Email Not Accepted**
- Solution: Use professional-looking Gmail or get business email from:
  - Zoho Mail (free for 1 email)
  - Domain.com email ($5/month)
  - Gmail with business domain ($6/user/month)

**Issue: Business Verification Pending**
- Solution: Usually takes 1-3 days. Can test with sandbox immediately.

**Issue: Webhook Not Receiving Messages**
- Solution: Verify webhook URL is HTTPS and accessible
- Check VERIFY_TOKEN matches
- Test with 360Dialog's webhook tester

**Issue: Messages Not Sending**
- Solution: Verify API key is correct
- Check you have sufficient credits
- Ensure number is approved for production

## Backend Integration Code

After you get 360Dialog credentials, I'll help you update the backend to support their API format. The main changes will be in `whatsapp.service.js` to handle 360Dialog's specific API endpoints and message format.

## Support

- 360Dialog Documentation: https://docs.360dialog.com
- Support Email: support@360dialog.com
- Hub Portal: https://hub.360dialog.com

## Next Steps After This Guide

1. **Try Signup Again**: Go to https://hub.360dialog.com/register
2. **If Successful**: 
   - Complete business verification
   - Purchase test number
   - Get API credentials
   - I'll update backend code for 360Dialog integration
3. **If Email Still Rejected**:
   - Quick option: Get Zoho Mail free email (10 minutes)
   - Or: Launch MVP with existing Meta number (Path A from earlier)

Let me know when you've signed up and I'll help with the backend integration!
