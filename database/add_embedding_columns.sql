-- Simplified fix: Just add columns and clear embeddings (skip index)

-- Step 1: Add embedding columns
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(50);

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ;

-- Step 2: Clear all embeddings to force re-sync
UPDATE products
SET 
    embedding = NULL,
    last_embedded_at = NULL
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0';

-- Step 3: Verify the setup
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'products' 
AND column_name IN ('embedding', 'embedding_model', 'last_embedded_at');

-- Step 4: Show how many products need embeddings
SELECT 
    COUNT(*) as products_needing_embeddings,
    MIN(name) as example_product
FROM products
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
AND is_active = true
AND embedding IS NULL;
