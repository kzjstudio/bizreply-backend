-- =====================================================
-- COMPLETE ADMIN DASHBOARD SETUP FOR SUPABASE
-- Run this ONCE in Supabase SQL Editor
-- =====================================================

-- Step 1: Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Step 2: Create Twilio numbers pool table
CREATE TABLE IF NOT EXISTS twilio_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  phone_number_id TEXT UNIQUE NOT NULL,
  assigned_to UUID REFERENCES businesses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_twilio_numbers_assigned ON twilio_numbers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_active ON twilio_numbers(is_active);

-- Step 3: Enable RLS
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE twilio_numbers ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop any existing policies to start fresh
DROP POLICY IF EXISTS "Admins can read admins table" ON admins;
DROP POLICY IF EXISTS "Authenticated users can check admin status" ON admins;
DROP POLICY IF EXISTS "Super admins can manage admins" ON admins;
DROP POLICY IF EXISTS "Allow authenticated users to read own admin record" ON admins;
DROP POLICY IF EXISTS "Super admins can insert admins" ON admins;
DROP POLICY IF EXISTS "Super admins can update admins" ON admins;
DROP POLICY IF EXISTS "Super admins can delete admins" ON admins;
DROP POLICY IF EXISTS "Admins can manage twilio numbers" ON twilio_numbers;

-- Step 5: Create is_admin() helper function
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admins
    WHERE email = auth.jwt() ->> 'email'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create simplified RLS policies
CREATE POLICY "Allow authenticated users to read own admin record" ON admins
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Admins can manage twilio numbers" ON twilio_numbers
  FOR ALL
  TO authenticated
  USING (is_admin());

-- Step 7: Insert your admin email (CHANGE THIS!)
INSERT INTO admins (email, role)
VALUES ('admin@kzjinnovations.com', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Step 8: Create dashboard stats function
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_businesses', (SELECT COUNT(*) FROM businesses),
    'active_businesses', (SELECT COUNT(*) FROM businesses WHERE is_active = true),
    'total_messages', (SELECT COALESCE(SUM(message_count), 0) FROM businesses),
    'total_products', (SELECT COUNT(*) FROM products),
    'active_integrations', (SELECT COUNT(*) FROM integrations WHERE is_active = true),
    'available_numbers', (SELECT COUNT(*) FROM twilio_numbers WHERE assigned_to IS NULL AND is_active = true),
    'assigned_numbers', (SELECT COUNT(*) FROM twilio_numbers WHERE assigned_to IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- Step 9: Verify setup
SELECT 'Setup complete! Run the queries below to verify:' AS status;

-- Verify tables exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('admins', 'twilio_numbers');

-- Verify policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies 
WHERE tablename IN ('admins', 'twilio_numbers');

-- Verify admin user
SELECT email, role, created_at FROM admins;
