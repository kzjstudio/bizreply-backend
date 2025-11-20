# Store Integration Guides

Complete step-by-step instructions for connecting various e-commerce platforms to BizReply.

---

## WooCommerce Integration

### Prerequisites
- WordPress site with WooCommerce plugin installed
- Admin access to your WordPress dashboard

### Step 1: Generate API Keys

1. **Log into your WordPress Admin Dashboard**
   - Go to `https://yourstore.com/wp-admin`

2. **Navigate to WooCommerce Settings**
   - Click on **WooCommerce** in the left sidebar
   - Click **Settings**
   - Click the **Advanced** tab
   - Click **REST API**

3. **Create New API Key**
   - Click **Add key** button
   - Fill in the details:
     - **Description**: `BizReply Integration`
     - **User**: Select your admin user
     - **Permissions**: Select **Read/Write**
   - Click **Generate API key**

4. **Copy Your Credentials**
   - **Consumer Key**: Copy and save this (starts with `ck_`)
   - **Consumer Secret**: Copy and save this (starts with `cs_`)
   - ⚠️ **Important**: Save these immediately! The secret won't be shown again.

### Step 2: Find Your Store URL

Your WooCommerce store URL is typically:
- `https://yourstore.com` (without `/wp-admin`)
- Example: `https://myshop.com`

### Step 3: Connect in BizReply App

1. Open BizReply app
2. Go to **Integrations** → **WooCommerce**
3. Enter:
   - **Store URL**: Your store URL (e.g., `https://myshop.com`)
   - **Consumer Key**: The `ck_` key you copied
   - **Consumer Secret**: The `cs_` secret you copied
4. Click **Connect**
5. Wait for products to sync (may take a few minutes)

### Troubleshooting

**Connection Failed?**
- ✅ Check your store URL doesn't have `/wp-admin` at the end
- ✅ Verify API keys are copied correctly
- ✅ Ensure your WordPress site has SSL (https://)
- ✅ Check WooCommerce REST API is enabled in Settings

**Products Not Syncing?**
- ✅ Verify products are published (not drafts)
- ✅ Check products have prices set
- ✅ Ensure API permissions are set to "Read/Write"

---

## Shopify Integration

### Prerequisites
- Active Shopify store
- Admin access to Shopify dashboard

### Step 1: Create Private App

1. **Log into Shopify Admin**
   - Go to `https://yourstore.myshopify.com/admin`

2. **Navigate to Apps**
   - Click **Settings** (bottom left)
   - Click **Apps and sales channels**
   - Click **Develop apps**

3. **Create New App**
   - Click **Create an app**
   - App name: `BizReply Integration`
   - Click **Create app**

4. **Configure Admin API Scopes**
   - Click **Configure Admin API scopes**
   - Select these permissions:
     - ✅ `read_products`
     - ✅ `read_product_listings`
     - ✅ `read_orders`
     - ✅ `read_customers`
   - Click **Save**

5. **Install App**
   - Click **Install app**
   - Click **Install** to confirm

6. **Get API Credentials**
   - Click **API credentials** tab
   - Copy these values:
     - **Admin API access token**: Your secret token
     - **API key**: Your app's API key
     - **API secret key**: Your app's secret

### Step 2: Find Your Store Details

- **Store URL**: `yourstore.myshopify.com`
- **API Version**: Use `2024-01` (or latest stable version)

### Step 3: Connect in BizReply App

1. Open BizReply app
2. Go to **Integrations** → **Shopify**
3. Enter:
   - **Store URL**: `yourstore.myshopify.com`
   - **Access Token**: The Admin API access token
   - **API Key**: Your API key
4. Click **Connect**
5. Products will sync automatically

### Troubleshooting

**Connection Failed?**
- ✅ Use `.myshopify.com` domain (not custom domain)
- ✅ Verify access token is copied correctly
- ✅ Check app is installed and not deleted
- ✅ Ensure API scopes include `read_products`

---

## Instagram Shopping Integration

### Prerequisites
- Instagram Business or Creator account
- Facebook Business Page connected to Instagram
- Product catalog in Facebook Commerce Manager
- Products approved for Instagram Shopping

### Step 1: Set Up Instagram Shopping

1. **Convert to Business Account**
   - Open Instagram app
   - Go to Settings → Account
   - Switch to Professional Account
   - Select Business

2. **Connect Facebook Page**
   - Go to Settings → Business
   - Connect to Facebook Page

3. **Set Up Shopping**
   - Go to Settings → Business → Shopping
   - Select your Product Catalog
   - Submit for review (takes 1-3 days)

### Step 2: Get Access Token

1. **Go to Facebook Developer Portal**
   - Visit `https://developers.facebook.com`
   - Create app (if you don't have one)
   - Select **Business** type

2. **Add Instagram Basic Display**
   - Go to **Products** → Add **Instagram Basic Display**
   - Complete setup wizard

3. **Generate User Token**
   - Go to **Instagram Basic Display** → **User Token Generator**
   - Click **Generate Token**
   - Log in with Instagram account
   - Grant permissions
   - Copy the **Access Token**

4. **Get Instagram Business Account ID**
   - Go to Graph API Explorer
   - Use endpoint: `/me/accounts`
   - Find your Instagram Business Account ID

### Step 3: Connect in BizReply App

1. Open BizReply app
2. Go to **Integrations** → **Instagram Shopping**
3. Enter:
   - **Instagram Business Account ID**: From Graph API
   - **Access Token**: Long-lived token
4. Click **Connect**

### Troubleshooting

**Connection Failed?**
- ✅ Account must be Business or Creator (not Personal)
- ✅ Shopping must be approved by Instagram
- ✅ Facebook Page must be connected
- ✅ Use long-lived access token (not short-lived)

---

## TikTok Shop Integration

### Prerequisites
- TikTok Shop Seller account
- Active TikTok Shop with approved products
- Seller Center access

### Step 1: Get API Credentials

1. **Log into TikTok Seller Center**
   - Go to `https://seller.tiktok.com`
   - Log in with your account

2. **Navigate to Developer Settings**
   - Click on **Settings** (gear icon)
   - Click **Open API**
   - Click **Add Authorization**

3. **Create Authorization**
   - Authorization name: `BizReply Integration`
   - Select permissions:
     - ✅ Product Management
     - ✅ Order Management
     - ✅ Fulfillment
   - Click **Create**

4. **Copy Credentials**
   - **App Key**: Your application key
   - **App Secret**: Your application secret
   - **Access Token**: Generated access token
   - **Shop ID**: Your shop identifier

### Step 2: Connect in BizReply App

1. Open BizReply app
2. Go to **Integrations** → **TikTok Shop**
3. Enter:
   - **Shop ID**: Your TikTok Shop ID
   - **App Key**: Your app key
   - **App Secret**: Your app secret
   - **Access Token**: Your access token
4. Click **Connect**

### Troubleshooting

**Connection Failed?**
- ✅ Seller account must be approved
- ✅ Shop must be active (not suspended)
- ✅ API permissions must include Product Management
- ✅ Access token must not be expired

---

## Facebook Marketplace Integration

### Prerequisites
- Facebook Business Page
- Commerce Manager account
- Product catalog created

### Step 1: Set Up Commerce Manager

1. **Create Commerce Account**
   - Go to `https://business.facebook.com/commerce`
   - Create new Commerce Account
   - Connect your Business Page

2. **Create Product Catalog**
   - Click **Catalogs** → **Create Catalog**
   - Select **E-commerce**
   - Name: Your store name
   - Click **Create**

3. **Get Access Credentials**
   - Go to **Settings** → **Business Settings**
   - Click **Data Sources** → **Catalogs**
   - Select your catalog
   - Copy **Catalog ID**

4. **Generate Access Token**
   - Go to **System Users**
   - Create system user: `BizReply Bot`
   - Generate new token with permissions:
     - ✅ `catalog_management`
     - ✅ `business_management`
   - Copy the access token

### Step 2: Connect in BizReply App

1. Open BizReply app
2. Go to **Integrations** → **Facebook Marketplace**
3. Enter:
   - **Catalog ID**: Your catalog ID
   - **Access Token**: System user token
   - **Business ID**: Your business ID
4. Click **Connect**

---

## General Tips

### Security Best Practices
- 🔒 Never share your API keys publicly
- 🔒 Use different keys for testing and production
- 🔒 Regenerate keys if compromised
- 🔒 Review connected apps regularly

### Sync Settings
- **Automatic Sync**: Products sync every hour
- **Manual Sync**: Click refresh in integrations page
- **Webhook Updates**: Real-time product updates (if supported)

### What Gets Synced?
- ✅ Product names and descriptions
- ✅ Prices and inventory
- ✅ Product images
- ✅ Categories and tags
- ✅ Variants and options
- ❌ Customer data (for privacy)
- ❌ Payment information

### Need Help?
- 📧 Email: support@bizreply.com
- 💬 Live chat in app
- 📖 Full documentation: docs.bizreply.com
