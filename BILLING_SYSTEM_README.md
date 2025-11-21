# Billing & Usage Tracking System

## Overview
Complete billing and usage tracking system for monitoring OpenAI API usage, managing subscriptions, and handling payments through Fygaro (Barbados payment gateway).

## Architecture

### Database Schema
Located in: `database/billing_and_usage_schema.sql`

**Tables:**
1. **subscription_plans** - Defines available plans (Free, Starter, Professional, Enterprise)
2. **subscriptions** - Business subscriptions with Fygaro integration
3. **api_usage** - Detailed logs of every OpenAI API call
4. **usage_summary** - Monthly aggregated usage per business
5. **invoices** - Billing invoices with Fygaro payment details
6. **payment_history** - Payment transaction logs
7. **usage_alerts** - Alerts for usage limits (80%, 100%)

**Key Features:**
- Auto-aggregation trigger updates usage_summary on every api_usage insert
- Computed columns for total tokens and costs
- Indexes for fast query performance
- Views for common queries (current_month_usage, business_subscriptions)

### Backend Services

#### 1. Usage Tracking Service
**File:** `services/usage-tracking.service.js`

**Features:**
- Tracks every OpenAI API call (tokens, costs, model)
- Calculates costs based on OpenAI pricing
- Checks usage limits before API calls
- Creates alerts at 80% and 100% of limit
- Provides usage analytics (current month, history, logs)

**Pricing per 1M tokens:**
```javascript
'gpt-4': { input: $30.00, output: $60.00 }
'gpt-4-turbo': { input: $10.00, output: $30.00 }
'gpt-3.5-turbo': { input: $0.50, output: $1.50 }
```

**Key Methods:**
- `trackUsage()` - Log API usage
- `getCurrentMonthUsage()` - Get current month stats
- `getUsageHistory()` - Get historical data
- `canMakeApiCall()` - Check if business can make API call
- `checkUsageLimits()` - Create alerts when approaching limits

#### 2. AI Service Integration
**Files:** `src/services/ai.service.js`, `services/aiEngine.js`

**Integration Points:**
- Checks usage limits before calling OpenAI
- Tracks usage after successful API call
- Returns error when limit exceeded

#### 3. Billing API Routes
**File:** `routes/billing.js`

**Endpoints:**
```
GET  /api/billing/:businessId/usage/current   - Current month usage
GET  /api/billing/:businessId/usage/history   - Usage history
GET  /api/billing/:businessId/usage/logs      - Detailed logs
GET  /api/billing/:businessId/alerts          - Unread alerts
POST /api/billing/:businessId/alerts/:id/read - Mark alert as read
GET  /api/billing/plans                        - All plans
GET  /api/billing/:businessId/subscription    - Subscription details
POST /api/billing/:businessId/subscription    - Create/update subscription
POST /api/billing/:businessId/subscription/cancel - Cancel subscription
GET  /api/billing/:businessId/invoices        - Get invoices
```

### Frontend (Flutter)

#### Models
**File:** `lib/models/billing.dart`

**Classes:**
- `UsageSummary` - Monthly usage aggregates
- `SubscriptionPlan` - Plan details
- `Subscription` - Business subscription
- `UsageAlert` - Usage limit alerts
- `ApiUsageLog` - Detailed usage logs
- `CurrentUsageData` - Combined current usage data

#### Service
**File:** `lib/services/billing_service.dart`

**Methods:**
- `getCurrentUsage()` - Fetch current month usage
- `getUsageHistory()` - Fetch historical data
- `getUsageLogs()` - Fetch detailed logs
- `getUnreadAlerts()` - Fetch alerts
- `markAlertAsRead()` - Dismiss alerts
- `getPlans()` - Fetch available plans
- `createOrUpdateSubscription()` - Manage subscriptions
- `cancelSubscription()` - Cancel subscription

#### UI Screen
**File:** `lib/screens/billing/usage_dashboard_screen.dart`

**Features:**
- **Overview Tab:**
  - Usage alerts banner
  - Progress card showing current usage vs limit
  - Stats grid (requests, tokens, costs)
  - Cost breakdown

- **History Tab:**
  - Line chart showing usage trend
  - Monthly usage list with costs

- **Plan Tab:**
  - Current plan details
  - Upgrade options
  - Billing cycle management

## Subscription Plans

### Free Plan
- **Price:** $0/month
- **Limits:** 100 messages/month
- **Features:** AI responses, basic analytics, product search

### Starter Plan
- **Price:** $29/month ($290/year)
- **Limits:** 1,000 messages/month
- **Features:** + Manual takeover

### Professional Plan
- **Price:** $99/month ($990/year)
- **Limits:** 5,000 messages/month
- **Features:** + Advanced analytics, priority support, custom training, API access

### Enterprise Plan
- **Price:** $299/month ($2,990/year)
- **Limits:** Unlimited messages
- **Features:** + Dedicated support, custom integrations

## Usage Limits & Alerts

### Automatic Alerts
1. **80% Warning** - Created when usage reaches 80% of limit
2. **100% Limit Reached** - Created when limit is reached
3. **API Calls Blocked** - When limit exceeded, AI returns upgrade message

### Alert Lifecycle
- Created automatically by usage tracking service
- Displayed prominently in dashboard
- User can dismiss after reading
- One alert per type per month

## Fygaro Integration

### Payment Gateway
Fygaro is a Caribbean-focused payment gateway supporting:
- Credit/Debit cards
- Local bank transfers
- Mobile payments
- BBD (Barbados Dollar) currency

### Integration Points
1. **Customer Creation**
   - Create Fygaro customer on first subscription
   - Store `fygaro_customer_id` in subscriptions table

2. **Subscription Creation**
   - Create Fygaro subscription for recurring billing
   - Store `fygaro_subscription_id`

3. **Invoice Payment**
   - Generate invoice in Fygaro
   - Store `fygaro_invoice_id` and `fygaro_payment_intent_id`

4. **Webhooks** (TODO)
   - Handle payment success/failure
   - Handle subscription renewal
   - Handle subscription cancellation

### Fygaro API Documentation
https://docs.fygaro.com (replace with actual Fygaro API docs)

## Setup Instructions

### 1. Database Migration
Run the schema in Supabase SQL Editor:
```bash
# Copy contents of database/billing_and_usage_schema.sql
# Paste into Supabase SQL Editor
# Execute
```

### 2. Environment Variables
Add to `.env`:
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview

# Fygaro Configuration (TODO)
FYGARO_API_KEY=your_fygaro_api_key
FYGARO_SECRET_KEY=your_fygaro_secret_key
FYGARO_WEBHOOK_SECRET=your_webhook_secret

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
```

### 3. Backend Deployment
```bash
cd bizreply-backend
git pull origin main
npm install
# Deploy to Render (auto-deploys from GitHub)
```

### 4. Flutter App
```bash
cd bizreply
flutter pub get
flutter run
```

## API Testing

### Get Current Usage
```bash
curl https://your-api.onrender.com/api/billing/BUSINESS_ID/usage/current
```

### Get Alerts
```bash
curl https://your-api.onrender.com/api/billing/BUSINESS_ID/alerts
```

### Create Subscription
```bash
curl -X POST https://your-api.onrender.com/api/billing/BUSINESS_ID/subscription \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "PLAN_UUID",
    "billingCycle": "monthly",
    "fygaroCustomerId": "cus_xxx"
  }'
```

## Monitoring & Analytics

### Key Metrics to Track
1. **Usage Trends** - Monthly growth in API calls
2. **Cost Per Business** - Average cost per business
3. **Plan Distribution** - Number of businesses per plan
4. **Limit Breaches** - How often users hit limits
5. **Churn Rate** - Subscription cancellations

### Database Queries

**Current month revenue:**
```sql
SELECT 
  SUM(total_amount) as revenue
FROM invoices
WHERE status = 'paid'
  AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW());
```

**Top spenders:**
```sql
SELECT 
  b.name,
  SUM(us.total_cost) as total_cost
FROM usage_summary us
JOIN businesses b ON us.business_id = b.id
WHERE us.year = EXTRACT(YEAR FROM NOW())
GROUP BY b.id, b.name
ORDER BY total_cost DESC
LIMIT 10;
```

## Future Enhancements

### Phase 2
- [ ] Fygaro webhook handlers
- [ ] Automatic invoice generation
- [ ] Email notifications for alerts
- [ ] Usage export (CSV/PDF)
- [ ] Custom plan creation (enterprise)
- [ ] Usage forecasting

### Phase 3
- [ ] Multi-currency support
- [ ] Volume discounts
- [ ] Referral program
- [ ] Usage API for business owners
- [ ] White-label billing

## Troubleshooting

### Issue: Usage not tracking
**Check:**
1. OpenAI API calls completing successfully
2. Database trigger is active
3. Supabase connection working

**Fix:**
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'trigger_update_usage_summary';

-- Manually test trigger
INSERT INTO api_usage (business_id, model, tokens_input, tokens_output, cost_input, cost_output)
VALUES ('test-business', 'gpt-4', 100, 200, 0.003, 0.012);

-- Check usage_summary updated
SELECT * FROM usage_summary WHERE business_id = 'test-business';
```

### Issue: Alerts not showing
**Check:**
1. Usage percentage calculation
2. Alert creation logic
3. hasAlert() check

**Fix:**
```sql
-- Manually create alert for testing
INSERT INTO usage_alerts (business_id, alert_type, threshold_percentage, title, message)
VALUES ('test-business', 'limit_80', 80, 'Test Alert', 'Test message');
```

### Issue: API calls blocked incorrectly
**Check:**
1. Subscription status
2. Message limit configuration
3. Usage count accuracy

**Fix:**
```javascript
// Test permission check
const permission = await usageTrackingService.canMakeApiCall('business-id');
console.log('Permission:', permission);
```

## Support

For issues or questions:
- Backend: Check `bizreply-backend/services/usage-tracking.service.js`
- Frontend: Check `bizreply/lib/screens/billing/usage_dashboard_screen.dart`
- Database: `database/billing_and_usage_schema.sql`

## License

Proprietary - BizReply AI © 2025
