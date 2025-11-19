-- BizReply AI - Supabase Database Schema
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/_/sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable vector extension for product embeddings (AI search)
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- BUSINESSES TABLE
-- Stores business owner information and platform credentials
-- =====================================================
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL, -- Supabase Auth user ID
    business_name VARCHAR(255) NOT NULL,
    
    -- WhatsApp Configuration
    whatsapp_number VARCHAR(20), -- User's contact number (deprecated after platform link)
    phone_number_id VARCHAR(50), -- Twilio WhatsApp Business number
    
    -- E-commerce Platform Integration
    platform_type VARCHAR(50), -- 'woocommerce', 'shopify', 'tiktok', 'instagram', 'manual'
    platform_url TEXT, -- Store URL (e.g., https://mystore.com)
    platform_credentials JSONB, -- Encrypted API keys/tokens
    last_synced_at TIMESTAMPTZ, -- Last product sync timestamp
    
    -- Business Information
    description TEXT,
    business_hours TEXT,
    location TEXT,
    
    -- AI Configuration
    ai_greeting_message TEXT,
    ai_instructions TEXT,
    ai_faqs TEXT, -- Stored as formatted string for now
    ai_special_offers TEXT,
    ai_do_not_mention TEXT,
    ai_tone VARCHAR(100) DEFAULT 'Professional and friendly',
    
    -- Metadata
    is_active BOOLEAN DEFAULT false, -- Admin activates after WhatsApp setup
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT businesses_owner_id_fkey FOREIGN KEY (owner_id) 
        REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Index for fast lookups
CREATE INDEX idx_businesses_phone_number_id ON businesses(phone_number_id);
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_platform_type ON businesses(platform_type);

-- =====================================================
-- PRODUCTS TABLE
-- Synced from e-commerce platforms or manually added
-- =====================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Platform Reference
    platform_product_id VARCHAR(255), -- ID from external platform
    platform_variant_id VARCHAR(255), -- For product variants
    
    -- Product Information
    name VARCHAR(500) NOT NULL,
    description TEXT,
    short_description TEXT, -- For quick AI responses
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    compare_at_price DECIMAL(10,2), -- Original price (for discounts)
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Inventory
    sku VARCHAR(255),
    inventory_quantity INTEGER DEFAULT 0,
    inventory_status VARCHAR(50) DEFAULT 'in_stock', -- 'in_stock', 'low_stock', 'out_of_stock'
    low_stock_threshold INTEGER DEFAULT 5,
    
    -- Categorization
    category VARCHAR(255),
    tags TEXT[], -- Array of tags for searching
    
    -- Media
    image_url TEXT,
    additional_images TEXT[], -- Array of image URLs
    
    -- Variants (size, color, etc.)
    has_variants BOOLEAN DEFAULT false,
    variant_options JSONB, -- e.g., {"size": ["S", "M", "L"], "color": ["Red", "Blue"]}
    
    -- SEO & Metadata
    product_url TEXT, -- Link to product page
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Sync Metadata
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_products_business_id ON products(business_id);
CREATE INDEX idx_products_platform_product_id ON products(platform_product_id);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_active ON products(is_active);
CREATE INDEX idx_products_inventory_status ON products(inventory_status);

-- Full text search on product name and description
CREATE INDEX idx_products_search ON products USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- =====================================================
-- PRODUCT EMBEDDINGS TABLE
-- Vector embeddings for semantic product search
-- =====================================================
CREATE TABLE product_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    embedding vector(1536), -- OpenAI ada-002 embedding dimension
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(product_id)
);

-- Vector similarity search index (cosine distance)
CREATE INDEX idx_product_embeddings_vector ON product_embeddings 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =====================================================
-- CONVERSATIONS TABLE
-- Groups messages by customer phone number
-- =====================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(255),
    
    -- Conversation Metadata
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    is_archived BOOLEAN DEFAULT false,
    
    -- Customer Context (for AI)
    customer_notes TEXT, -- Business owner notes about customer
    preferred_language VARCHAR(10) DEFAULT 'en',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(business_id, customer_phone)
);

CREATE INDEX idx_conversations_business_id ON conversations(business_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- =====================================================
-- MESSAGES TABLE
-- All WhatsApp messages (incoming and outgoing)
-- =====================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    -- Message Details
    message_sid VARCHAR(255), -- Twilio message ID
    direction VARCHAR(20) NOT NULL, -- 'incoming', 'outgoing'
    message_text TEXT NOT NULL,
    
    -- Sender/Receiver
    from_phone VARCHAR(20) NOT NULL,
    to_phone VARCHAR(20) NOT NULL,
    
    -- Message Type
    type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'document', etc.
    media_url TEXT,
    
    -- AI Metadata
    sent_by VARCHAR(20) DEFAULT 'ai', -- 'ai', 'manual', 'automation'
    ai_confidence DECIMAL(3,2), -- 0.00 to 1.00 (AI confidence score)
    
    -- Status
    status VARCHAR(50) DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
    error_message TEXT,
    
    -- Timestamps
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_business_id ON messages(business_id);
CREATE INDEX idx_messages_timestamp ON messages(timestamp DESC);
CREATE INDEX idx_messages_direction ON messages(direction);

-- =====================================================
-- PRODUCT RECOMMENDATIONS TABLE
-- Track what AI recommended to customers
-- =====================================================
CREATE TABLE product_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Recommendation Context
    recommended_reason TEXT, -- Why AI suggested this product
    customer_query TEXT, -- What customer asked
    
    -- Tracking
    was_clicked BOOLEAN DEFAULT false,
    was_purchased BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_recommendations_conversation_id ON product_recommendations(conversation_id);
CREATE INDEX idx_product_recommendations_product_id ON product_recommendations(product_id);

-- =====================================================
-- ANALYTICS TABLE (Optional - for future)
-- Track business performance metrics
-- =====================================================
CREATE TABLE analytics_daily (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    
    -- Message Metrics
    total_messages INTEGER DEFAULT 0,
    incoming_messages INTEGER DEFAULT 0,
    outgoing_messages INTEGER DEFAULT 0,
    ai_responses INTEGER DEFAULT 0,
    manual_responses INTEGER DEFAULT 0,
    
    -- Conversation Metrics
    new_conversations INTEGER DEFAULT 0,
    active_conversations INTEGER DEFAULT 0,
    
    -- Product Metrics
    products_recommended INTEGER DEFAULT 0,
    products_clicked INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(business_id, date)
);

CREATE INDEX idx_analytics_business_date ON analytics_daily(business_id, date DESC);

-- =====================================================
-- UPDATED_AT TRIGGER FUNCTION
-- Auto-update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Isolate data between businesses
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;

-- Businesses: Users can only see their own businesses
CREATE POLICY "Users can view their own businesses" ON businesses
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own businesses" ON businesses
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own businesses" ON businesses
    FOR UPDATE USING (auth.uid() = owner_id);

-- Products: Users can only see products from their businesses
CREATE POLICY "Users can view products from their businesses" ON products
    FOR SELECT USING (
        business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

CREATE POLICY "Users can manage products from their businesses" ON products
    FOR ALL USING (
        business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    );

-- Similar policies for other tables...
-- (Add more RLS policies as needed for conversations, messages, etc.)

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_business_id UUID,
    p_customer_phone VARCHAR(20)
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- Try to find existing conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE business_id = p_business_id AND customer_phone = p_customer_phone;
    
    -- If not found, create new conversation
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (business_id, customer_phone)
        VALUES (p_business_id, p_customer_phone)
        RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search products by semantic similarity
CREATE OR REPLACE FUNCTION search_products_semantic(
    p_business_id UUID,
    p_query_embedding vector(1536),
    p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    product_name VARCHAR(500),
    price DECIMAL(10,2),
    similarity FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.name,
        p.price,
        1 - (pe.embedding <=> p_query_embedding) AS similarity
    FROM products p
    JOIN product_embeddings pe ON p.id = pe.product_id
    WHERE p.business_id = p_business_id AND p.is_active = true
    ORDER BY pe.embedding <=> p_query_embedding
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEED DATA (Optional - for testing)
-- =====================================================

-- Insert a test business (you'll need to replace with real auth user ID)
-- INSERT INTO businesses (owner_id, business_name, phone_number_id, platform_type, is_active)
-- VALUES (
--     'YOUR_SUPABASE_AUTH_USER_ID',
--     'Test Store',
--     '+18583608131',
--     'manual',
--     true
-- );

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'BizReply AI schema created successfully!';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Configure RLS policies for your security requirements';
    RAISE NOTICE '2. Set up Supabase Auth for user authentication';
    RAISE NOTICE '3. Integrate Supabase client in backend and Flutter app';
END $$;
