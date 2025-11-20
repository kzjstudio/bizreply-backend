# Render Environment Variables Update

## Required Action
You need to add these two environment variables to your Render service:

1. Go to https://dashboard.render.com
2. Select your bizreply-backend service
3. Go to Environment tab
4. Add these variables:

### New Environment Variables

**SUPABASE_URL**
```
https://eqbshjucplafhiytooha.supabase.co
```

**SUPABASE_SERVICE_KEY**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxYnNoanVjcGxhZmhpeXRvb2hhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NDc4OSwiZXhwIjoyMDc5MTYwNzg5fQ.4mzHTV4WAW2FJRPb1lYRNCH-T248Z0aVDeqAYpjLzMM
```

## Deployment
After adding these environment variables, Render will automatically redeploy your service with the new configuration.

## What Changed
-  Installed @supabase/supabase-js package
-  Created src/services/supabase.service.js with all database functions
-  Updated src/controllers/whatsapp.controller.js to use Supabase instead of Firebase
-  Updated business data fields from camelCase to snake_case (business_name, business_hours, etc.)
-  Added AI configuration fields to system prompts
-  Committed and pushed to GitHub

## Testing
Once deployed, send a WhatsApp message to +18583608131 to test the Supabase integration.

## Rollback Plan (if needed)
If there are issues, you can revert to the previous commit:
```bash
git revert HEAD
git push origin main
```

This will restore the Firebase integration while we troubleshoot.
