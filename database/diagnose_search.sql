-- Diagnose search_similar_products function

-- 1. Check if products have embeddings
SELECT 
    COUNT(*) as total_products,
    COUNT(embedding) as products_with_embeddings,
    COUNT(*) - COUNT(embedding) as products_without_embeddings
FROM products
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
    AND is_active = true;

-- 2. Check the actual function definition
SELECT 
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'search_similar_products';

-- 3. Test if the function exists and can be called
-- Note: This will fail without a real embedding, but shows if function is callable
SELECT EXISTS (
    SELECT 1 
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'search_similar_products'
) as function_exists;
