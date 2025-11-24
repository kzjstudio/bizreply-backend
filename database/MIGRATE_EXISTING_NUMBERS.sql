-- =====================================================
-- MIGRATE EXISTING WHATSAPP NUMBERS TO TWILIO_NUMBERS TABLE
-- Run this AFTER running ADMIN_SETUP_COMPLETE.sql
-- This will copy any existing phone_number_id from businesses into twilio_numbers
-- =====================================================

-- Insert existing business phone numbers into twilio_numbers table
INSERT INTO twilio_numbers (phone_number, phone_number_id, assigned_to, assigned_at, is_active)
SELECT 
  COALESCE(whatsapp_number, phone_number_id) as phone_number,
  phone_number_id,
  id as assigned_to,
  updated_at as assigned_at,
  true as is_active
FROM businesses
WHERE phone_number_id IS NOT NULL
  AND phone_number_id != ''
  AND NOT EXISTS (
    SELECT 1 FROM twilio_numbers 
    WHERE twilio_numbers.phone_number_id = businesses.phone_number_id
  );

-- Verify migration
SELECT 
  tn.phone_number,
  tn.phone_number_id,
  b.business_name,
  tn.assigned_at
FROM twilio_numbers tn
LEFT JOIN businesses b ON b.id = tn.assigned_to
ORDER BY tn.created_at DESC;
