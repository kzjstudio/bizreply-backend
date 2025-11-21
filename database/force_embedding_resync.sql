-- COMPREHENSIVE FIX: Ensure products table has embedding column and force re-sync

-- Step 1: Make sure products table has the embedding column
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ;

-- Step 2: Create index on embedding column for fast searches
CREATE INDEX IF NOT EXISTS idx_products_embedding 
ON products USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Step 3: Clear all embeddings to force re-sync
UPDATE products 
SET 
    embedding = NULL,
    last_embedded_at = NULL
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0';

-- Step 4: Verify the setup
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('embedding', 'embedding_model', 'last_embedded_at');

-- Step 5: Show products that need embeddings
SELECT 
    COUNT(*) as products_needing_embeddings,
    MIN(name) as example_product
FROM products
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
AND is_active = true
AND embedding IS NULL;

-- This should show a count > 0 if products exist
