-- =====================================================
-- BILLING & USAGE TRACKING SCHEMA
-- For OpenAI API usage tracking and Fygaro billing
-- =====================================================

-- 1. SUBSCRIPTION PLANS TABLE
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  tier VARCHAR(20) NOT NULL, -- 'free', 'starter', 'professional', 'enterprise'
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2),
  message_limit INTEGER, -- NULL = unlimited
  features JSONB, -- Store plan features as JSON
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. SUBSCRIPTIONS TABLE (Business subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  
  -- Fygaro Integration
  fygaro_customer_id VARCHAR(255),
  fygaro_subscription_id VARCHAR(255),
  
  -- Subscription Details
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'past_due', 'cancelled', 'trial'
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- 'monthly', 'yearly'
  
  -- Period
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  trial_end TIMESTAMP WITH TIME ZONE,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id)
);

-- 3. API USAGE TABLE (Detailed usage logs)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  
  -- OpenAI API Details
  model VARCHAR(50) NOT NULL, -- 'gpt-4', 'gpt-3.5-turbo', etc.
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  total_tokens INTEGER GENERATED ALWAYS AS (tokens_input + tokens_output) STORED,
  
  -- Cost Calculation
  cost_input DECIMAL(10,6) NOT NULL,
  cost_output DECIMAL(10,6) NOT NULL,
  total_cost DECIMAL(10,6) GENERATED ALWAYS AS (cost_input + cost_output) STORED,
  
  -- Request Details
  request_type VARCHAR(50), -- 'chat_completion', 'embedding', etc.
  customer_phone VARCHAR(50),
  
  -- Metadata
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- 4. USAGE SUMMARY TABLE (Aggregated usage per month)
CREATE TABLE IF NOT EXISTS usage_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Period
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  
  -- Usage Totals
  total_requests INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  total_tokens_input INTEGER DEFAULT 0,
  total_tokens_output INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,2) DEFAULT 0,
  
  -- Model Breakdown
  usage_by_model JSONB, -- {"gpt-4": {tokens: 1000, cost: 0.03}, ...}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(business_id, year, month)
);

-- 5. INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Invoice Details
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Amounts
  subscription_amount DECIMAL(10,2) DEFAULT 0,
  usage_amount DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (subscription_amount + usage_amount) STORED,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  
  -- Fygaro Integration
  fygaro_invoice_id VARCHAR(255),
  fygaro_payment_intent_id VARCHAR(255),
  
  -- Payment Details
  paid_at TIMESTAMP WITH TIME ZONE,
  payment_method VARCHAR(50),
  
  -- Files
  invoice_pdf_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. PAYMENT HISTORY TABLE
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  
  -- Payment Details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'BBD',
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'pending', 'refunded'
  
  -- Fygaro Integration
  fygaro_transaction_id VARCHAR(255),
  fygaro_payment_method VARCHAR(50),
  
  -- Metadata
  failure_reason TEXT,
  metadata JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. USAGE ALERTS TABLE
CREATE TABLE IF NOT EXISTS usage_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Alert Details
  alert_type VARCHAR(50) NOT NULL, -- 'limit_80', 'limit_100', 'overage'
  threshold_percentage INTEGER,
  
  -- Alert Content
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_api_usage_business_timestamp ON api_usage(business_id, timestamp DESC);
CREATE INDEX idx_api_usage_conversation ON api_usage(conversation_id);
CREATE INDEX idx_api_usage_timestamp ON api_usage(timestamp DESC);
CREATE INDEX idx_usage_summary_business_period ON usage_summary(business_id, year, month);
CREATE INDEX idx_subscriptions_business ON subscriptions(business_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_payment_history_business ON payment_history(business_id);
CREATE INDEX idx_usage_alerts_business_unread ON usage_alerts(business_id, is_read);

-- =====================================================
-- FUNCTIONS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update usage summary when new API usage is logged
CREATE OR REPLACE FUNCTION update_usage_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO usage_summary (
    business_id,
    year,
    month,
    total_requests,
    total_tokens_input,
    total_tokens_output,
    total_tokens,
    total_cost
  )
  VALUES (
    NEW.business_id,
    EXTRACT(YEAR FROM NEW.timestamp),
    EXTRACT(MONTH FROM NEW.timestamp),
    1,
    NEW.tokens_input,
    NEW.tokens_output,
    NEW.total_tokens,
    NEW.total_cost
  )
  ON CONFLICT (business_id, year, month)
  DO UPDATE SET
    total_requests = usage_summary.total_requests + 1,
    total_tokens_input = usage_summary.total_tokens_input + NEW.tokens_input,
    total_tokens_output = usage_summary.total_tokens_output + NEW.tokens_output,
    total_tokens = usage_summary.total_tokens + NEW.total_tokens,
    total_cost = usage_summary.total_cost + NEW.total_cost,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update usage summary
DROP TRIGGER IF EXISTS trigger_update_usage_summary ON api_usage;
CREATE TRIGGER trigger_update_usage_summary
  AFTER INSERT ON api_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_summary();

-- =====================================================
-- SEED DEFAULT SUBSCRIPTION PLANS
-- =====================================================

INSERT INTO subscription_plans (name, tier, price_monthly, price_yearly, message_limit, features) VALUES
('Free Plan', 'free', 0.00, 0.00, 100, '{"ai_responses": true, "basic_analytics": true, "product_search": true, "manual_takeover": false, "priority_support": false}'),
('Starter Plan', 'starter', 29.00, 290.00, 1000, '{"ai_responses": true, "basic_analytics": true, "product_search": true, "manual_takeover": true, "priority_support": false, "custom_training": false}'),
('Professional Plan', 'professional', 99.00, 990.00, 5000, '{"ai_responses": true, "advanced_analytics": true, "product_search": true, "manual_takeover": true, "priority_support": true, "custom_training": true, "api_access": true}'),
('Enterprise Plan', 'enterprise', 299.00, 2990.00, NULL, '{"ai_responses": true, "advanced_analytics": true, "product_search": true, "manual_takeover": true, "priority_support": true, "custom_training": true, "api_access": true, "dedicated_support": true, "custom_integrations": true}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: Current month usage by business
CREATE OR REPLACE VIEW current_month_usage AS
SELECT 
  b.id as business_id,
  b.business_name,
  COALESCE(us.total_requests, 0) as total_requests,
  COALESCE(us.total_tokens, 0) as total_tokens,
  COALESCE(us.total_cost, 0) as total_cost,
  sp.message_limit,
  CASE 
    WHEN sp.message_limit IS NULL THEN 0
    ELSE ROUND((COALESCE(us.total_requests, 0)::DECIMAL / sp.message_limit) * 100, 2)
  END as usage_percentage
FROM businesses b
LEFT JOIN subscriptions s ON b.id = s.business_id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN usage_summary us ON b.id = us.business_id 
  AND us.year = EXTRACT(YEAR FROM NOW())
  AND us.month = EXTRACT(MONTH FROM NOW());

-- View: Business subscription details
CREATE OR REPLACE VIEW business_subscriptions AS
SELECT 
  b.id as business_id,
  b.business_name,
  sp.name as plan_name,
  sp.tier as plan_tier,
  sp.price_monthly,
  s.status as subscription_status,
  s.current_period_end,
  s.cancel_at_period_end
FROM businesses b
LEFT JOIN subscriptions s ON b.id = s.business_id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id;
