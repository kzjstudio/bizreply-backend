-- Force drop ALL versions of the search function
-- This ensures we're starting fresh

DROP FUNCTION IF EXISTS search_similar_products CASCADE;
DROP FUNCTION IF EXISTS public.search_similar_products CASCADE;
DROP FUNCTION IF EXISTS search_products_semantic CASCADE;
DROP FUNCTION IF EXISTS public.search_products_semantic CASCADE;

-- Verify cleanup
DO $$
BEGIN
    RAISE NOTICE 'Old functions dropped, creating new function...';
END $$;

-- Create the function with EXPLICIT TEXT casting to avoid VARCHAR issues
CREATE FUNCTION public.search_similar_products(
    query_embedding vector(1536),
    business_id_param UUID,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    product_description TEXT,
    price DECIMAL(10,2),
    sale_price DECIMAL(10,2),
    category TEXT,
    image_url TEXT,
    external_id TEXT,
    sku TEXT,
    stock_quantity INTEGER,
    source_platform TEXT,
    similarity FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.name::TEXT,              -- Explicit cast to TEXT
        p.description::TEXT,        -- Explicit cast to TEXT
        p.price,
        p.sale_price,
        p.category::TEXT,           -- Explicit cast to TEXT
        p.image_url::TEXT,          -- Explicit cast to TEXT
        p.external_id::TEXT,        -- Explicit cast to TEXT
        p.sku::TEXT,                -- Explicit cast to TEXT
        p.stock_quantity,
        p.source_platform::TEXT,    -- Explicit cast to TEXT
        (1 - (p.embedding <=> query_embedding))::FLOAT
    FROM products p
    WHERE 
        p.business_id = business_id_param 
        AND p.is_active = true
        AND p.embedding IS NOT NULL
        AND (1 - (p.embedding <=> query_embedding)) >= match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Grant all necessary permissions
GRANT EXECUTE ON FUNCTION public.search_similar_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_similar_products TO anon;
GRANT EXECUTE ON FUNCTION public.search_similar_products TO service_role;

-- Verify the function was created successfully
DO $$
DECLARE
    func_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO func_count
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name = 'search_similar_products';
    
    IF func_count > 0 THEN
        RAISE NOTICE '✓ Function search_similar_products created successfully!';
    ELSE
        RAISE WARNING '✗ Function was not created!';
    END IF;
END $$;

-- Show the function definition to verify
SELECT 
    routine_name,
    routine_schema,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'search_similar_products';
