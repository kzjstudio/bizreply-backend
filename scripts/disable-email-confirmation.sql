-- Disable email confirmation for easier testing (optional - run this in Supabase SQL Editor)
-- This allows users to sign up without confirming their email

-- Note: In production, you should enable email confirmation for security
-- To disable: Go to Supabase Dashboard > Authentication > Settings > Email Auth > 
-- Turn OFF "Enable email confirmations"

-- Check current RLS policies on businesses table
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'businesses';

-- If you need to temporarily disable RLS for testing (NOT recommended for production)
-- ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;

-- Or add a more permissive policy for authenticated users to insert
DROP POLICY IF EXISTS "Users can insert their own business" ON businesses;
CREATE POLICY "Users can insert their own business"
ON businesses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Verify the policy was created
SELECT * FROM pg_policies WHERE tablename = 'businesses' AND cmd = 'INSERT';
