-- Migration: Add Instagram support columns
-- Date: 2025-11-22
-- Idempotent additions for conversations table

ALTER TABLE conversations ADD COLUMN IF NOT EXISTS instagram_user_id text;

-- Optional: track the source channel of the conversation (e.g., 'whatsapp','instagram')
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS channel text DEFAULT 'whatsapp';

-- Index to speed up lookups by Instagram user
CREATE INDEX IF NOT EXISTS conversations_instagram_user_idx ON conversations(instagram_user_id);
CREATE INDEX IF NOT EXISTS conversations_channel_idx ON conversations(channel);

-- Messages table: add a channel column for future multi-channel analytics
ALTER TABLE messages ADD COLUMN IF NOT EXISTS channel text;

-- Backfill existing WhatsApp conversations/messages with channel='whatsapp'
UPDATE conversations SET channel='whatsapp' WHERE channel IS NULL;
UPDATE messages SET channel='whatsapp' WHERE channel IS NULL;

-- NOTE: For new Instagram DMs, set channel='instagram' when inserting.
-- The instagram.service.js currently only sets conversation fields; consider updating message insert to include channel if required.
