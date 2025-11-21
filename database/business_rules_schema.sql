-- =====================================================
-- BUSINESS RULES ENGINE - Production-Ready Schema
-- Add comprehensive business policy and rules management
-- =====================================================

-- Add new columns to businesses table for comprehensive rules engine
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS store_hours JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS delivery_rules JSONB;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS refund_policy TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS return_policy TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS shipping_policy TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS privacy_policy TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS terms_of_service TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS forbidden_responses TEXT[]; -- Array of topics AI should never discuss
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS custom_rules TEXT[]; -- Array of custom business rules
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS escalation_keywords TEXT[]; -- Keywords that should trigger human agent escalation
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ai_language VARCHAR(10) DEFAULT 'en'; -- Language for AI responses
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ai_max_response_length INTEGER DEFAULT 500; -- Max chars per response
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS support_hours TEXT;

-- Comment on new columns
COMMENT ON COLUMN businesses.store_hours IS 'JSONB format: {"monday": {"open": "09:00", "close": "17:00", "closed": false}, ...}';
COMMENT ON COLUMN businesses.delivery_rules IS 'JSONB format: {"min_order": 25, "free_shipping_threshold": 50, "delivery_time": "2-3 business days", "areas": ["US", "CA"]}';
COMMENT ON COLUMN businesses.refund_policy IS 'Full refund policy text that AI can reference';
COMMENT ON COLUMN businesses.return_policy IS 'Return policy details (time frame, conditions, process)';
COMMENT ON COLUMN businesses.shipping_policy IS 'Shipping rates, methods, and estimated delivery times';
COMMENT ON COLUMN businesses.forbidden_responses IS 'Array of topics/keywords AI should refuse to discuss (e.g., ["politics", "religion", "medical advice"])';
COMMENT ON COLUMN businesses.custom_rules IS 'Array of custom business rules for AI to follow';
COMMENT ON COLUMN businesses.escalation_keywords IS 'Keywords that should trigger human agent notification (e.g., ["complaint", "refund", "manager"])';

-- Example data structure for store_hours:
-- {
--   "monday": {"open": "09:00", "close": "17:00", "closed": false},
--   "tuesday": {"open": "09:00", "close": "17:00", "closed": false},
--   "wednesday": {"open": "09:00", "close": "17:00", "closed": false},
--   "thursday": {"open": "09:00", "close": "17:00", "closed": false},
--   "friday": {"open": "09:00", "close": "20:00", "closed": false},
--   "saturday": {"open": "10:00", "close": "18:00", "closed": false},
--   "sunday": {"closed": true},
--   "timezone": "America/New_York",
--   "holidays": ["2024-12-25", "2024-01-01"]
-- }

-- Example data structure for delivery_rules:
-- {
--   "min_order_amount": 25.00,
--   "free_shipping_threshold": 50.00,
--   "standard_delivery_time": "2-3 business days",
--   "express_delivery_time": "1 business day",
--   "express_delivery_cost": 15.00,
--   "delivery_areas": ["US", "CA"],
--   "restrictions": "Cannot ship to PO boxes",
--   "international_shipping": false
-- }

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_businesses_ai_language ON businesses(ai_language);

-- =====================================================
-- CONVERSATION ESCALATION TABLE
-- Track when conversations need human intervention
-- =====================================================
CREATE TABLE IF NOT EXISTS conversation_escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    reason TEXT NOT NULL, -- Why escalation was triggered
    triggered_keyword TEXT, -- The keyword that triggered escalation
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'assigned', 'resolved'
    assigned_to UUID, -- Staff member assigned (future feature)
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX idx_escalations_business ON conversation_escalations(business_id);
CREATE INDEX idx_escalations_status ON conversation_escalations(status);
CREATE INDEX idx_escalations_priority ON conversation_escalations(priority);

-- =====================================================
-- AI RESPONSE AUDIT LOG
-- Track all AI responses for quality control
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_response_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    customer_message TEXT NOT NULL,
    ai_response TEXT NOT NULL,
    products_recommended UUID[], -- Array of product IDs recommended
    rules_triggered TEXT[], -- Which business rules were applied
    response_time_ms INTEGER, -- Time taken to generate response
    model_used VARCHAR(50), -- e.g., 'gpt-4', 'gpt-3.5-turbo'
    tokens_used INTEGER,
    cost_usd DECIMAL(10,6), -- Estimated cost
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_business ON ai_response_audit(business_id);
CREATE INDEX idx_audit_created_at ON ai_response_audit(created_at);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if business is currently open
CREATE OR REPLACE FUNCTION is_business_open(
    business_id_param UUID,
    check_time TIMESTAMPTZ DEFAULT NOW()
) RETURNS BOOLEAN AS $$
DECLARE
    store_hours_data JSONB;
    day_of_week TEXT;
    time_to_check TIME;
    day_hours JSONB;
BEGIN
    -- Get store hours
    SELECT store_hours INTO store_hours_data
    FROM businesses
    WHERE id = business_id_param;
    
    IF store_hours_data IS NULL THEN
        RETURN TRUE; -- Assume open if no hours specified
    END IF;
    
    -- Get day of week (lowercase)
    day_of_week := LOWER(TO_CHAR(check_time, 'Day'));
    day_of_week := TRIM(day_of_week);
    
    -- Get hours for this day
    day_hours := store_hours_data -> day_of_week;
    
    IF day_hours IS NULL THEN
        RETURN TRUE; -- No specific hours for this day
    END IF;
    
    -- Check if closed
    IF (day_hours ->> 'closed')::BOOLEAN THEN
        RETURN FALSE;
    END IF;
    
    -- Check time range
    time_to_check := check_time::TIME;
    
    RETURN time_to_check >= (day_hours ->> 'open')::TIME 
        AND time_to_check <= (day_hours ->> 'close')::TIME;
END;
$$ LANGUAGE plpgsql;

-- Function to get next opening time
CREATE OR REPLACE FUNCTION get_next_opening_time(
    business_id_param UUID
) RETURNS TEXT AS $$
DECLARE
    store_hours_data JSONB;
    day_of_week TEXT;
    day_hours JSONB;
    days TEXT[] := ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    current_day_index INT;
    check_day_index INT;
    check_day TEXT;
BEGIN
    -- Get store hours
    SELECT store_hours INTO store_hours_data
    FROM businesses
    WHERE id = business_id_param;
    
    IF store_hours_data IS NULL THEN
        RETURN 'Store hours not configured';
    END IF;
    
    -- Get current day index
    day_of_week := LOWER(TO_CHAR(NOW(), 'Day'));
    day_of_week := TRIM(day_of_week);
    current_day_index := array_position(days, day_of_week);
    
    -- Check next 7 days
    FOR i IN 1..7 LOOP
        check_day_index := ((current_day_index + i - 1) % 7) + 1;
        check_day := days[check_day_index];
        day_hours := store_hours_data -> check_day;
        
        IF day_hours IS NOT NULL AND NOT (day_hours ->> 'closed')::BOOLEAN THEN
            RETURN 'Opens ' || INITCAP(check_day) || ' at ' || (day_hours ->> 'open');
        END IF;
    END LOOP;
    
    RETURN 'Closed indefinitely';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION is_business_open IS 'Check if a business is currently open based on store hours';
COMMENT ON FUNCTION get_next_opening_time IS 'Get the next opening time for a business';
