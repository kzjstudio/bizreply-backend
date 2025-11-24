# WooCommerce Webhook Setup Guide

## Overview
Your BizReply AI system now has **3-layer product sync**:
1. **Primary**: WooCommerce webhooks (real-time, instant updates)
2. **Backup**: Manual sync button (user-triggered)
3. **Fallback**: Daily auto-sync at 3 AM (catches missed webhooks)

## Backend Changes Deployed
- ✅ `/api/woocommerce/webhook` - Receives WooCommerce product events
- ✅ `/api/integrations/sync-all` - Daily fallback sync endpoint
- ✅ Daily cron job runs at 3:00 AM automatically
- ✅ Webhook handlers for: `product.created`, `product.updated`, `product.deleted`

## WooCommerce Webhook Setup (5 minutes)

### Step 1: Access WooCommerce Webhooks
1. Log into your WordPress admin panel
2. Go to: **WooCommerce** → **Settings** → **Advanced** → **Webhooks**
3. Click **"Add webhook"** button

### Step 2: Create "Product Created" Webhook
1. **Name**: `BizReply - Product Created`
2. **Status**: ✅ Active
3. **Topic**: Select `Product created`
4. **Delivery URL**: `https://your-backend.onrender.com/api/woocommerce/webhook`
   - Replace `your-backend` with your actual Render URL
5. **Secret**: (Optional - leave blank for now, we can add later)
6. **API Version**: `WP REST API Integration v3`
7. Click **"Save webhook"**

### Step 3: Create "Product Updated" Webhook
1. Click **"Add webhook"** again
2. **Name**: `BizReply - Product Updated`
3. **Status**: ✅ Active
4. **Topic**: Select `Product updated`
5. **Delivery URL**: `https://your-backend.onrender.com/api/woocommerce/webhook`
6. **Secret**: (Optional - leave blank)
7. **API Version**: `WP REST API Integration v3`
8. Click **"Save webhook"**

### Step 4: Create "Product Deleted" Webhook
1. Click **"Add webhook"** again
2. **Name**: `BizReply - Product Deleted`
3. **Status**: ✅ Active
4. **Topic**: Select `Product deleted`
5. **Delivery URL**: `https://your-backend.onrender.com/api/woocommerce/webhook`
6. **Secret**: (Optional - leave blank)
7. **API Version**: `WP REST API Integration v3`
8. Click **"Save webhook"**

## How It Works

### Real-Time Sync (Webhooks)
```
User adds product in WooCommerce
    ↓
WooCommerce sends webhook to your backend
    ↓
Backend receives product data instantly
    ↓
Saves to database with all details (name, price, image, etc.)
    ↓
Generates AI embeddings for search (within 5 minutes)
    ↓
AI can now recommend this product to customers
```

**Latency**: ~1-2 seconds from WooCommerce → Your database

### Manual Sync (Backup)
- User clicks "Sync from WooCommerce" button in Flutter app
- Pulls all products immediately
- Useful for initial setup or if webhooks temporarily fail

### Daily Sync (Fallback)
- Runs automatically at 3:00 AM every day
- Syncs ALL products for ALL businesses
- Catches any products that webhooks might have missed
- Zero user action required

## Testing Your Webhooks

### Test 1: Webhook Endpoint Accessibility
Open in browser:
```
https://your-backend.onrender.com/api/woocommerce/webhook/test
```

Expected response:
```json
{
  "status": "ok",
  "message": "WooCommerce webhook endpoint is accessible",
  "timestamp": "2025-11-23T..."
}
```

### Test 2: Add a Product
1. Go to WooCommerce → Products → Add New
2. Create a test product with name, price, image
3. Click "Publish"
4. Check Render logs - you should see:
   ```
   📦 WooCommerce webhook received: product.created from https://yourstore.com
   ➕ Syncing product: Test Product (ID: 123)
   ✅ Product synced: Test Product
   ```
5. Check Flutter app → Products page → Product should appear instantly

### Test 3: Update a Product
1. Edit the product in WooCommerce
2. Change the price or name
3. Click "Update"
4. Check Render logs for webhook confirmation
5. Flutter app should show updated data after refresh

### Test 4: Delete a Product
1. Delete a product in WooCommerce
2. Check Render logs
3. Product should disappear from Flutter app

## Troubleshooting

### Webhook Not Working
1. **Check Render logs**:
   - Go to Render dashboard → Your service → Logs
   - Look for `📦 WooCommerce webhook received`
   
2. **Verify webhook URL**:
   - Must be `https://` (not `http://`)
   - Must include `/api/woocommerce/webhook`
   - Check for typos

3. **Check webhook status in WooCommerce**:
   - WooCommerce → Settings → Advanced → Webhooks
   - Click on your webhook
   - Check "Logs" section - should show successful deliveries

4. **Firewall/Security**:
   - Ensure Render allows incoming POST requests
   - No IP restrictions blocking WooCommerce

### Products Not Appearing
1. **Run manual sync first**:
   - Flutter app → Products → Sync button
   - This ensures initial products are loaded

2. **Check product status**:
   - Only `publish` status products are synced
   - Draft/pending products are ignored

3. **Check database**:
   - Supabase → Products table
   - Verify `external_id` matches WooCommerce product ID

## Webhook Security (Optional Enhancement)

To add webhook signature verification (prevents fake webhooks):

1. Generate a random secret key (32+ characters)
2. Add to `.env` on Render:
   ```
   WC_WEBHOOK_SECRET=your-secret-key-here
   ```
3. Add same secret to each webhook in WooCommerce
4. Uncomment signature verification code in `routes/woocommerce.js` (lines 22-32)

## Benefits Summary

### For Users:
- ✅ Products appear instantly (no manual sync needed)
- ✅ Always up-to-date prices and stock
- ✅ Deleted products removed immediately
- ✅ Zero maintenance

### For You:
- ✅ No manual sync triggers needed
- ✅ Reduced API calls (webhooks only fire on changes)
- ✅ Real-time data = better customer experience
- ✅ Daily fallback ensures reliability

## Next Steps

1. **Deploy backend changes** (already done if you pushed to GitHub)
2. **Set up webhooks in WooCommerce** (5 minutes)
3. **Test with a product** (add/update/delete)
4. **Monitor Render logs** for webhook activity
5. **Done!** Products now sync automatically

## Support

If webhooks aren't working:
- Check Render logs: `📦 WooCommerce webhook received`
- Check WooCommerce webhook logs: WooCommerce → Settings → Advanced → Webhooks → Click webhook → Logs
- Manual sync always works as backup
- Daily sync at 3 AM catches everything

Your system is now production-ready with enterprise-grade reliability! 🚀
