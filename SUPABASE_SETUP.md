# BizReply AI - Supabase Setup Guide

## Step 1: Create Supabase Project

1. Go to **https://supabase.com** and sign up
2. Click **"New project"**
3. Configure:
   - **Name:** `bizreply-ai`
   - **Database Password:** (generate and save securely)
   - **Region:** Choose closest to your Render deployment
   - **Plan:** Free tier (upgrade later)
4. Wait 2 minutes for project to initialize

## Step 2: Run SQL Schema

1. In your Supabase dashboard, go to **SQL Editor**
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql`
4. Paste into the SQL editor
5. Click **"Run"** (bottom right)
6. Verify success message appears

## Step 3: Get API Keys

Go to **Project Settings** → **API**:

### Save these values:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc... (public key - safe for Flutter)
SUPABASE_SERVICE_KEY=eyJhbGc... (secret key - backend only!)
```

## Step 4: Enable Required Extensions

The schema automatically enables these, but verify in **Database** → **Extensions**:

- ✅ `uuid-ossp` - UUID generation
- ✅ `vector` - Vector embeddings for AI product search

If `vector` extension is not available, enable it:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

## Step 5: Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider (already enabled by default)
3. Configure email templates (optional)
4. Later: Enable **Google OAuth** for easier signups

## Step 6: Set Up Storage (for product images)

1. Go to **Storage**
2. Create new bucket: `product-images`
3. Set policies:
   - **Public access:** Allow read
   - **Authenticated upload:** Business owners only

## Database Schema Overview

### Core Tables:

| Table | Purpose |
|-------|---------|
| `businesses` | Business profiles, WhatsApp config, AI settings |
| `products` | Product catalog synced from platforms |
| `product_embeddings` | Vector embeddings for semantic search |
| `conversations` | Customer conversations grouped by phone |
| `messages` | All WhatsApp messages |
| `product_recommendations` | Track AI recommendations |
| `analytics_daily` | Business metrics (future) |

### Key Features:

✅ **Row Level Security (RLS)** - Data isolation between businesses
✅ **Vector Search** - Semantic product matching
✅ **Full-Text Search** - Fast product name/description search
✅ **Auto-updated timestamps** - `updated_at` triggers
✅ **Helper functions** - `get_or_create_conversation()`, `search_products_semantic()`

## Testing the Schema

Run this query to verify everything is set up:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Should show:
-- analytics_daily
-- businesses
-- conversations
-- messages
-- product_embeddings
-- product_recommendations
-- products
```

## Next Steps

1. ✅ **Install Supabase SDK in backend:**
   ```bash
   npm install @supabase/supabase-js
   ```

2. ✅ **Install Supabase SDK in Flutter:**
   ```bash
   flutter pub add supabase_flutter
   ```

3. ✅ **Migrate existing Firebase data** to Supabase

4. ✅ **Update backend services** to use Supabase client

5. ✅ **Update Flutter app** to use Supabase client

## Environment Variables

### Backend (.env):
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
```

### Flutter (lib/config/supabase_config.dart):
```dart
const supabaseUrl = 'https://xxxxx.supabase.co';
const supabaseAnonKey = 'eyJhbGc...';
```

## Troubleshooting

### "extension vector does not exist"
Run: `CREATE EXTENSION vector;` in SQL Editor

### RLS blocking queries
Temporarily disable for testing:
```sql
ALTER TABLE businesses DISABLE ROW LEVEL SECURITY;
```
(Re-enable before production!)

### Can't see inserted data
Check if user is authenticated and RLS policies allow access

## Cost Estimation

**Supabase Free Tier:**
- ✅ 500 MB database
- ✅ 1 GB bandwidth
- ✅ 50,000 monthly active users
- ✅ Unlimited API requests

**When to upgrade ($25/month):**
- > 8 GB database
- > 250 GB bandwidth
- Need custom domains
- Need daily backups

---

**Ready to proceed?** 
Once Supabase is set up, let me know and I'll start migrating the backend!
