-- Manual Business Migration to Supabase
-- Run this in Supabase SQL Editor after creating a user

-- STEP 1: Create a test user in Supabase Auth first
-- Go to Supabase Dashboard > Authentication > Users > Add User
-- Use email: test@bizreply.ai (or the actual owner email)
-- Save the UUID that gets generated

-- STEP 2: Replace 'YOUR_USER_UUID' below with the actual UUID from Step 1
-- Then run this INSERT statement

INSERT INTO businesses (
    owner_id,
    business_name,
    phone_number_id,
    whatsapp_number,
    description,
    business_hours,
    location,
    ai_greeting_message,
    ai_instructions,
    ai_faqs,
    ai_special_offers,
    ai_do_not_mention,
    ai_tone,
    is_active
) VALUES (
    'YOUR_USER_UUID_HERE',  -- Replace with actual Supabase Auth user UUID
    'Test Business',         -- Replace with actual business name from Firebase
    '+18583608131',          -- Your Twilio WhatsApp number (from logs)
    NULL,                    -- Original whatsapp_number (deprecated)
    'AI-powered customer service',
    'Monday-Friday, 9am-5pm EST',
    'United States',
    'Hello! Thanks for reaching out. How can I help you today?',
    'Be friendly and professional. Always ask clarifying questions.',
    NULL,                    -- FAQs (from Firebase if available)
    NULL,                    -- Special offers (from Firebase if available)
    NULL,                    -- Topics to avoid
    'Professional and friendly',
    true                     -- Active status
);

-- STEP 3: Verify insertion
SELECT * FROM businesses WHERE phone_number_id = '+18583608131';

-- STEP 4: Test webhook
-- Send WhatsApp message to +18583608131 and check Render logs
