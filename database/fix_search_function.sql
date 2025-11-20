-- Fix the search function to match the code's expectations and use TEXT columns
-- This replaces search_products_semantic with search_similar_products

DROP FUNCTION IF EXISTS search_products_semantic(UUID, vector, INTEGER);
DROP FUNCTION IF EXISTS search_similar_products(vector, UUID, FLOAT, INTEGER);

-- Create the function with the correct name and return types
CREATE OR REPLACE FUNCTION search_similar_products(
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
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.description AS product_description,
        p.price,
        p.sale_price,
        p.category,
        p.image_url,
        p.external_id,
        p.sku,
        p.stock_quantity,
        p.source_platform,
        1 - (p.embedding <=> query_embedding) AS similarity
    FROM products p
    WHERE 
        p.business_id = business_id_param 
        AND p.is_active = true
        AND p.embedding IS NOT NULL
        AND (1 - (p.embedding <=> query_embedding)) >= match_threshold
    ORDER BY p.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_similar_products TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_products TO anon;
