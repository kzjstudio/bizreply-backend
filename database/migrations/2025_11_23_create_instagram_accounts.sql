-- Migration: Create instagram_accounts table for per-business Instagram integration
-- Date: 2025-11-23
-- Description: Stores mapping between a business and its connected Facebook Page / Instagram Business Account.
-- Idempotent: uses IF NOT EXISTS guards.

CREATE TABLE IF NOT EXISTS instagram_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  page_id text NOT NULL,                       -- Facebook Page ID
  ig_business_id text,                         -- Instagram Business Account ID (connected_instagram_account.id)
  page_name text,                              -- Display name of the Page
  access_token text NOT NULL,                  -- Long-lived Page access token (should be encrypted at rest)
  user_long_lived_token text,                  -- Optional: user long-lived token if retained
  user_token_expires_at timestamptz,           -- Expiry timestamp for user token (~60 days)
  granted_scopes jsonb,                        -- Array/list of scopes granted at connect time
  status text DEFAULT 'active',                -- active | revoked | error
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS instagram_accounts_business_idx ON instagram_accounts(business_id);
CREATE INDEX IF NOT EXISTS instagram_accounts_page_idx ON instagram_accounts(page_id);
CREATE INDEX IF NOT EXISTS instagram_accounts_status_idx ON instagram_accounts(status);

-- Optional future: encryption / separate table for token vault.
-- Ensure pgcrypto extension enabled if encryption planned: CREATE EXTENSION IF NOT EXISTS pgcrypto;
