-- Function to increment message_count for a business
-- This is called every time the AI successfully responds to a message

CREATE OR REPLACE FUNCTION increment_message_count(business_id_param UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE businesses
  SET message_count = COALESCE(message_count, 0) + 1
  WHERE id = business_id_param;
END;
$$;

-- Grant execute permission to authenticated and service role users
GRANT EXECUTE ON FUNCTION increment_message_count(UUID) TO authenticated, service_role;

-- Test the function (optional - comment out after testing)
-- SELECT increment_message_count('your-business-id-here');
-- SELECT id, business_name, message_count FROM businesses WHERE id = 'your-business-id-here';
