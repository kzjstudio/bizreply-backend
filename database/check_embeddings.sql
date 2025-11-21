-- Quick check: Do embeddings actually exist?

SELECT 
    id,
    name,
    price,
    CASE 
        WHEN embedding IS NULL THEN 'NO EMBEDDING '
        ELSE 'HAS EMBEDDING  (dim: ' || array_length(embedding::real[], 1) || ')'
    END as embedding_status
FROM products
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
    AND is_active = true
ORDER BY name
LIMIT 20;

-- Count
SELECT 
    COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding,
    COUNT(*) FILTER (WHERE embedding IS NULL) as without_embedding,
    COUNT(*) as total
FROM products
WHERE business_id = '85732846-c2b4-4c60-b651-08d5f606eef0'
    AND is_active = true;
