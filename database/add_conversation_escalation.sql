-- Add escalation and handoff columns to conversations table
-- =====================================================

-- Add new columns for human handoff
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS mode VARCHAR(20) DEFAULT 'ai', -- 'ai', 'human', 'paused'
ADD COLUMN IF NOT EXISTS escalation_requested BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escalation_reason TEXT,
ADD COLUMN IF NOT EXISTS escalation_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id), -- Business owner/staff who took over
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalation_count INTEGER DEFAULT 0; -- Track repeated escalations

-- Create index for finding escalated conversations
CREATE INDEX IF NOT EXISTS idx_conversations_escalation ON conversations(business_id, escalation_requested) 
WHERE escalation_requested = true;

CREATE INDEX IF NOT EXISTS idx_conversations_mode ON conversations(business_id, mode);

-- Add column to businesses for notification preferences
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS notification_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb;

-- Create escalations summary view for dashboard
CREATE OR REPLACE VIEW escalated_conversations_summary AS
SELECT 
    b.id as business_id,
    b.business_name,
    COUNT(CASE WHEN c.escalation_requested = true AND c.mode != 'human' THEN 1 END) as pending_escalations,
    COUNT(CASE WHEN c.mode = 'human' THEN 1 END) as active_human_chats,
    MAX(c.escalation_requested_at) as last_escalation_at
FROM businesses b
LEFT JOIN conversations c ON b.id = c.business_id
GROUP BY b.id, b.business_name;

COMMENT ON COLUMN conversations.mode IS 'Conversation control mode: ai (AI handles), human (human handles), paused (AI disabled)';
COMMENT ON COLUMN conversations.escalation_requested IS 'Customer requested to speak with human representative';
COMMENT ON COLUMN conversations.escalation_reason IS 'Why customer wants human help (captured from AI conversation)';
COMMENT ON COLUMN conversations.assigned_to IS 'User ID of staff member handling this conversation';
