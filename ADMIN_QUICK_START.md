# 🚀 BizReply Admin Dashboard - Quick Start

## What You Have Now

✅ **Backend API Routes** (Deployed to Render)
- `/api/admin/stats` - Dashboard statistics
- `/api/admin/businesses` - Business CRUD operations
- `/api/admin/twilio-numbers` - WhatsApp number management
- Admin authentication middleware

✅ **Database Schema** (Ready to run)
- `database/admin_dashboard.sql` - Complete schema

✅ **Frontend Dashboard** (Ready to deploy)
- Next.js 16 admin interface
- Login page with admin verification
- Dashboard home with stats
- Mobile responsive design

## 🎯 Next Steps (15 minutes)

### Step 1: Set Up Database (5 min)

1. Open your Supabase project: https://supabase.com/dashboard
2. Go to **SQL Editor**
3. **IMPORTANT**: First, update the admin email in `database/admin_dashboard.sql` line 56:
   ```sql
   INSERT INTO admins (email, role)
   VALUES ('YOUR_EMAIL@kzjinnovations.com', 'super_admin')
   ```
4. Copy entire contents of `database/admin_dashboard.sql`
5. Paste and click **Run**
6. Verify: Go to **Table Editor** → You should see `admins` and `twilio_numbers` tables

### Step 2: Create Admin User (2 min)

1. In Supabase, go to **Authentication** → **Users**
2. Click **Add User** → **Create new user**
3. Enter:
   - Email: (same email you used in SQL file)
   - Password: (create strong password)
   - Confirm: ✅ Auto Confirm User
4. Click **Create User**
5. Your admin account is now ready!

### Step 3: Configure Frontend (3 min)

1. Open `bizreply-admin/.env.local`
2. Update values:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-supabase-settings
   NEXT_PUBLIC_API_URL=https://kzjinnovations.com/api
   NEXT_PUBLIC_ADMIN_EMAILS=your-admin-email@kzjinnovations.com
   ```
3. Get Supabase keys: **Settings** → **API** → Copy URL and anon key

### Step 4: Test Locally (5 min)

```bash
cd bizreply-admin
npm run dev
```

1. Open http://localhost:3000
2. Sign in with your admin email/password
3. You should see dashboard with stats!

**If it works**: You're ready to deploy! 🎉

**If "Admin access required" error**:
- Go to Supabase → SQL Editor
- Run: `SELECT * FROM admins;`
- If empty, your INSERT didn't work. Run the INSERT manually with your email.

## 📱 Test User Deletion (For Testing Signup Flow)

### Option 1: Supabase Dashboard
1. Go to **Authentication** → **Users**
2. Find test user
3. Click 3 dots → **Delete User**
4. Done! All related data (business, products, integrations) auto-deleted via CASCADE

### Option 2: Admin Dashboard (Once deployed)
You'll be able to delete users from the admin interface.

## 🚀 Deploy to Production

### Deploy Frontend to Vercel (Recommended)

1. Create new GitHub repo for `bizreply-admin`
   ```bash
   cd bizreply-admin
   git remote add origin https://github.com/YOUR-USERNAME/bizreply-admin.git
   git push -u origin master
   ```

2. Go to https://vercel.com
3. Click **Add New** → **Project**
4. Import `bizreply-admin` repository
5. Add environment variables (same as `.env.local`)
6. Click **Deploy**
7. Done! You'll get a URL like `https://bizreply-admin.vercel.app`

### Add Custom Domain (Optional)

In Vercel dashboard:
1. Project Settings → **Domains**
2. Add: `bizreply-dashboard.kzjinnovations.com`
3. Follow DNS instructions
4. Wait 5-10 minutes for DNS propagation

## 🎨 What You Can Do Now

✅ **View Dashboard Stats**
- Total businesses
- Total messages
- Products synced
- WhatsApp numbers

✅ **View All Businesses** (via API)
```bash
# Get auth token first from browser DevTools after login
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://kzjinnovations.com/api/admin/businesses
```

## 🔜 Phase 2: Business Management UI

Next steps to build:
1. `/dashboard/businesses` - List page with table
2. `/dashboard/businesses/[id]` - Business details page
3. `/dashboard/numbers` - Twilio number management

Want me to build these next?

## 🆘 Troubleshooting

### Can't sign in
- Check email matches the one in `admins` table
- Verify user exists in Supabase Auth
- Check browser console for errors

### "Admin access required"
- Run: `SELECT * FROM admins WHERE email = 'your-email@domain.com';`
- If no results, admin record missing. Run INSERT again.

### Stats show 0 for everything
- Backend might not be deployed yet
- Check Render logs: https://dashboard.render.com
- Verify `/api/admin/stats` endpoint works

### Can't connect to Supabase
- Double-check `.env.local` has correct URL and keys
- Verify RLS policies are enabled on tables
- Check Supabase dashboard for service status

## 📞 Ready to Launch?

Before launching to users, you should:
1. ✅ Test admin login
2. ✅ Verify stats load correctly
3. ✅ Test creating/deleting test users
4. ✅ Add a few Twilio numbers to the pool
5. ⏳ Build business list page
6. ⏳ Build number assignment UI

You're now set up with a professional admin dashboard! 🎉
