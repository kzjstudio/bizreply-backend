-- Fix RLS policy for admins table to allow login
-- Run this in Supabase SQL Editor

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Admins can read admins table" ON admins;

-- Create new policy that allows authenticated users to check their own admin status
CREATE POLICY "Authenticated users can check admin status" ON admins
  FOR SELECT
  USING (
    auth.jwt() ->> 'email' = email
  );

-- Also fix the typo in twilio_numbers policy
DROP POLICY IF EXISTS "Admins can manage twilio numbers" ON twilio_numbers;

CREATE POLICY "Admins can manage twilio numbers" ON twilio_numbers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.email = auth.jwt() ->> 'email'
    )
  );

-- Verify policies are correct
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('admins', 'twilio_numbers');
