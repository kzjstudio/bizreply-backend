-- Add product_url column to products table if it does not exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_url TEXT;