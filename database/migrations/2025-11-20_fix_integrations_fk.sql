-- Migration: Fix incorrect foreign key reference on integrations.business_id
-- Simple, idempotent approach using IF EXISTS

ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_business_id_fkey;
ALTER TABLE integrations
  ADD CONSTRAINT integrations_business_id_fkey FOREIGN KEY (business_id)
  REFERENCES businesses(id) ON DELETE CASCADE;

-- Verification (run separately after migration):
-- SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.table_name='integrations' AND tc.constraint_type='FOREIGN KEY';
