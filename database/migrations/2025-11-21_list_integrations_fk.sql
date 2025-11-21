-- Migration: Add function to list integrations foreign key status
CREATE OR REPLACE FUNCTION list_integrations_fk()
RETURNS TABLE(constraint_name text, column_name text, foreign_table text, foreign_column text) AS $$
SELECT tc.constraint_name, kcu.column_name, ccu.table_name, ccu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name='integrations' AND tc.constraint_type='FOREIGN KEY';
$$ LANGUAGE sql STABLE;
