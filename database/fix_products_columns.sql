-- Fix products table column types to match what the function expects
ALTER TABLE products 
  ALTER COLUMN description TYPE TEXT,
  ALTER COLUMN category TYPE TEXT,
  ALTER COLUMN sku TYPE TEXT,
  ALTER COLUMN source_platform TYPE TEXT;

-- Ensure external_id can be longer
ALTER TABLE products 
  ALTER COLUMN external_id TYPE TEXT;

-- Check if embedding column exists and has correct type
-- The embedding column should be vector(1536) for OpenAI embeddings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'embedding'
  ) THEN
    ALTER TABLE products ADD COLUMN embedding vector(1536);
  END IF;
END $$;
