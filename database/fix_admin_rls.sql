-- Fix RLS policy for admins table to allow login
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies on admins table
DROP POLICY IF EXISTS "Admins can read admins table" ON admins;
DROP POLICY IF EXISTS "Authenticated users can check admin status" ON admins;
DROP POLICY IF EXISTS "Super admins can manage admins" ON admins;
DROP POLICY IF EXISTS "Allow authenticated users to read own admin record" ON admins;
DROP POLICY IF EXISTS "Super admins can insert admins" ON admins;
DROP POLICY IF EXISTS "Super admins can update admins" ON admins;
DROP POLICY IF EXISTS "Super admins can delete admins" ON admins;

-- Simple policy: Authenticated users can read their own admin record
CREATE POLICY "Allow authenticated users to read own admin record" ON admins
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

-- Note: For INSERT/UPDATE/DELETE on admins, use service role key from backend
-- This avoids infinite recursion issues with RLS policies

-- Fix twilio_numbers policy to avoid recursion
DROP POLICY IF EXISTS "Admins can manage twilio numbers" ON twilio_numbers;

-- Simpler approach: Just check if authenticated user's email exists in admins
-- We'll use a function to avoid recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Admins can manage twilio numbers" ON twilio_numbers
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Verify policies are correct
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('admins', 'twilio_numbers');
