-- Create admins table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'support')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);

-- Create RLS policies
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;

-- Only admins can read admin table
CREATE POLICY "Admins can read admins table" ON admins
  FOR SELECT
  USING (
    email IN (SELECT email FROM admins)
  );

-- Only super admins can insert/update/delete
CREATE POLICY "Super admins can manage admins" ON admins
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.email = auth.jwt() ->> 'email'
      AND admins.role = 'super_admin'
    )
  );

-- Create Twilio numbers pool table
CREATE TABLE IF NOT EXISTS twilio_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT UNIQUE NOT NULL,
  phone_number_id TEXT UNIQUE NOT NULL,
  assigned_to UUID REFERENCES businesses(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_assigned ON twilio_numbers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_twilio_numbers_active ON twilio_numbers(is_active);

-- RLS policies for twilio_numbers
ALTER TABLE twilio_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage twilio numbers" ON twilio_numbers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.email = auth.jwt() ->> 'email'
    )
  );

-- Insert default super admin (UPDATE THIS EMAIL)
INSERT INTO admins (email, role)
VALUES ('admin@kzjinnovations.com', 'super_admin')
ON CONFLICT (email) DO NOTHING;

-- Function to get admin dashboard stats
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
    'total_messages', (SELECT SUM(message_count) FROM businesses),
    'total_products', (SELECT COUNT(*) FROM products),
    'active_integrations', (SELECT COUNT(*) FROM integrations WHERE is_active = true),
    'available_numbers', (SELECT COUNT(*) FROM twilio_numbers WHERE assigned_to IS NULL AND is_active = true),
    'assigned_numbers', (SELECT COUNT(*) FROM twilio_numbers WHERE assigned_to IS NOT NULL)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function to get business details with related data
CREATE OR REPLACE FUNCTION get_business_details(business_id_param UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'business', (SELECT row_to_json(b.*) FROM businesses b WHERE b.id = business_id_param),
    'integrations', (SELECT json_agg(i.*) FROM integrations i WHERE i.business_id = business_id_param),
    'products_count', (SELECT COUNT(*) FROM products WHERE business_id = business_id_param),
    'assigned_number', (SELECT row_to_json(t.*) FROM twilio_numbers t WHERE t.assigned_to = business_id_param)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_business_details(UUID) TO authenticated;
