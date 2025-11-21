-- Test search_similar_products function

-- First, verify embeddings exist
SELECT 
    id,
    name,
    price,
    CASE 
        WHEN embedding IS NULL THEN 'NO EMBEDDING'
        ELSE 'HAS EMBEDDING'
    END as embedding_status,
    embedding_model,
    last_embedded_at
FROM products
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
    AND is_active = true
ORDER BY name
LIMIT 20;

-- Test the search function with a simple query
-- Note: You'll need to generate an embedding first, so let's test with a product's own embedding
SELECT 
    p1.name as test_product,
    similarity,
    p2.name as matched_product,
    p2.price
FROM products p1
CROSS JOIN LATERAL (
    SELECT 
        1 - (p1.embedding <=> p3.embedding) as similarity,
        p3.name,
        p3.price
    FROM products p3
    WHERE p3.business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
        AND p3.embedding IS NOT NULL
        AND p3.id != p1.id
    ORDER BY p1.embedding <=> p3.embedding
    LIMIT 5
) p2
WHERE p1.business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
    AND p1.embedding IS NOT NULL
    AND p1.name = 'Dad hat'
LIMIT 5;
