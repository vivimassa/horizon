# Navigation System Setup Guide

## Quick Start

Follow these steps to set up the navigation system in your Horizon application.

## Step 1: Run Database Migration

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/001_create_operators_table.sql`
4. Click **Run** to execute the migration

This will create:
- `operators` table with proper schema
- Row-level security policies
- Automatic trigger to create operator records for new users
- Indexes for performance

## Step 2: Register Your First User

1. Start the development server (if not already running):
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in your browser

3. You'll be redirected to `/login`

4. Click **Register** and create an account with your email and password

5. After registration, you'll be automatically logged in and redirected to the home page

## Step 3: Set Yourself as Admin

After registering, you need to grant yourself admin access:

### Method A: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor** → **operators**
3. Find your user record (by email)
4. Click **Edit**
5. Update the following fields:
   - `role`: Change to `admin`
   - `enabled_modules`: Set to `{home,network,operations,workforce,reports,admin}`
6. Click **Save**

### Method B: Using SQL Editor

Run this query (replace with your actual email):

```sql
UPDATE operators
SET
  role = 'admin',
  full_name = 'Your Name',  -- Optional
  enabled_modules = ARRAY['home', 'network', 'operations', 'workforce', 'reports', 'admin']::TEXT[]
WHERE email = 'your-email@example.com';
```

## Step 4: Refresh and Test

1. Refresh your browser (or log out and log back in)
2. You should now see:
   - ✅ All module cards on the home page are accessible
   - ✅ Admin icon in the dock is clickable (not grayed out)
   - ✅ Admin icon tooltip says "Admin" instead of "Administrator access required"
   - ✅ Your role badge shows "admin"

## Verify Navigation Features

Test the following features:

### ✅ Dock Navigation
- [ ] H logo links to home
- [ ] Click each module icon to navigate
- [ ] Active module is highlighted in the dock
- [ ] Hover tooltips appear on all icons
- [ ] Admin icon is accessible

### ✅ Breadcrumbs
- [ ] Breadcrumbs show current location
- [ ] Click breadcrumb segments to navigate back
- [ ] Home icon appears as first breadcrumb

### ✅ Module Tabs
- [ ] Each module has Control, Tools, Reports tabs
- [ ] Active tab is highlighted
- [ ] Clicking tabs navigates correctly

### ✅ Access Control
- [ ] Create a second test user (non-admin)
- [ ] Login as test user
- [ ] Verify Admin icon is grayed out with tooltip
- [ ] Try accessing `/admin` directly → should show "Access Denied"

## Managing User Access

### Grant Module Access to a User

```sql
UPDATE operators
SET enabled_modules = ARRAY['home', 'network', 'operations']::TEXT[]
WHERE email = 'user@example.com';
```

### Remove Module Access

```sql
UPDATE operators
SET enabled_modules = ARRAY['home']::TEXT[]
WHERE email = 'user@example.com';
```

### Make User an Admin

```sql
UPDATE operators
SET role = 'admin',
    enabled_modules = ARRAY['home', 'network', 'operations', 'workforce', 'reports', 'admin']::TEXT[]
WHERE email = 'user@example.com';
```

### Demote Admin to Operator

```sql
UPDATE operators
SET role = 'operator',
    enabled_modules = ARRAY['home', 'network', 'operations', 'workforce', 'reports']::TEXT[]
WHERE email = 'user@example.com';
```

## Default New User Permissions

When a new user registers, they automatically receive:
- **Role**: `operator`
- **Modules**: `network`, `operations`, `workforce`, `reports`

This is configured in the `handle_new_user()` trigger function. You can modify it by editing the SQL:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.operators (user_id, email, enabled_modules)
  VALUES (
    NEW.id,
    NEW.email,
    ARRAY['network', 'operations', 'workforce', 'reports']::TEXT[]  -- Customize here
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Troubleshooting

### Issue: "Access Denied" on all modules

**Cause**: Your operator record doesn't have the required modules enabled.

**Solution**:
```sql
-- Check your current permissions
SELECT * FROM operators WHERE email = 'your-email@example.com';

-- Add all modules
UPDATE operators
SET enabled_modules = ARRAY['home', 'network', 'operations', 'workforce', 'reports', 'admin']::TEXT[]
WHERE email = 'your-email@example.com';
```

### Issue: Admin icon not clickable even after setting role

**Cause**: Browser cache or session not refreshed.

**Solution**:
1. Sign out completely
2. Clear browser cache (or use incognito/private mode)
3. Sign back in

### Issue: Operator record not created on signup

**Cause**: Trigger didn't fire or RLS policies blocking.

**Solution**:
```sql
-- Manually create operator record
INSERT INTO operators (user_id, email, enabled_modules)
SELECT id, email, ARRAY['network', 'operations', 'workforce', 'reports']::TEXT[]
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

### Issue: Can't access any modules after login

**Cause**: No operator record exists.

**Solution**: See previous troubleshooting step to manually create record.

## Next Steps

Now that your navigation is set up, you can:

1. **Build module features**: Add functionality to each module's Control, Tools, and Reports tabs
2. **Customize module access**: Create an admin interface to manage user permissions
3. **Add more modules**: Follow the guide in `NAVIGATION.md` to add custom modules
4. **Implement role-based features**: Use the helper functions in `lib/operators.ts` to check permissions

## Support

For issues or questions:
- Check `NAVIGATION.md` for detailed component documentation
- Review the SQL migration file for database schema details
- Inspect `lib/operators.ts` for access control logic
