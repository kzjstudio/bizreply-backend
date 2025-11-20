-- Create integrations table to store connected e-commerce platforms
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(business_id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  credentials JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  products_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, platform)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_integrations_business_id ON integrations(business_id);
CREATE INDEX IF NOT EXISTS idx_integrations_platform ON integrations(platform);

-- Add RLS policies
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own integrations"
  ON integrations FOR SELECT
  USING (auth.uid() IN (
    SELECT owner_id FROM businesses WHERE business_id = integrations.business_id
  ));

CREATE POLICY "Users can insert their own integrations"
  ON integrations FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT owner_id FROM businesses WHERE business_id = integrations.business_id
  ));

CREATE POLICY "Users can update their own integrations"
  ON integrations FOR UPDATE
  USING (auth.uid() IN (
    SELECT owner_id FROM businesses WHERE business_id = integrations.business_id
  ));

CREATE POLICY "Users can delete their own integrations"
  ON integrations FOR DELETE
  USING (auth.uid() IN (
    SELECT owner_id FROM businesses WHERE business_id = integrations.business_id
  ));

-- Add columns to products table if they don't exist
ALTER TABLE products 
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS stock_quantity INTEGER,
  ADD COLUMN IF NOT EXISTS sku VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_platform VARCHAR(50);

-- Create unique index on business_id and external_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_business_external 
  ON products(business_id, external_id);

-- Add index for source platform
CREATE INDEX IF NOT EXISTS idx_products_source_platform 
  ON products(source_platform);
