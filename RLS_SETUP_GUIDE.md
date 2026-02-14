# RLS Setup Guide

## Problem
✅ Data has been seeded successfully (63 airports, 48 countries, 44 airlines, 72 city pairs)
❌ RLS (Row Level Security) is enabled but no policies exist, blocking all access

## Solution
Apply the RLS policies migration to allow authenticated users to read reference data.

## Step-by-Step Instructions

### Option 1: Supabase Dashboard (Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your Horizon project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy the Migration SQL**
   - Open the file: `supabase/migrations/005_create_rls_policies.sql`
   - Copy ALL the contents (296 lines)

4. **Paste and Execute**
   - Paste the SQL into the SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for "Success. No rows returned" message

5. **Verify**
   - Run the verification script: `npm run verify-rls`
   - You should see airports and other data loading

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
# Apply all pending migrations
supabase db push

# Or apply specific migration
supabase db push --include-all
```

## What the Migration Does

### 1. Helper Functions
Creates two functions used by policies:

```sql
is_admin() - Returns true if user has 'admin' or 'super_admin' role
get_user_operator_id() - Returns the user's operator_id from user_roles
```

### 2. Reference Data Tables Policies
For `countries`, `airports`, `airlines`, `city_pairs`:

- ✅ **SELECT**: All authenticated users can read
- ⚠️  **INSERT/UPDATE/DELETE**: Only admins can modify

### 3. Operator-Scoped Tables Policies
For `aircraft_types`:

- ✅ **SELECT**: Users can read their operator's data
- ⚠️  **INSERT/UPDATE/DELETE**: Only admins of the operator can modify

### 4. User Tables Policies
For `user_roles`, `user_preferences`:

- ✅ **SELECT**: Users can read their own records
- ⚠️  **ADMIN SELECT**: Admins can read all records
- ⚠️  **INSERT/UPDATE/DELETE**: Only admins can modify

### 5. Operators Table Policies
- ✅ **SELECT**: All authenticated users can read operators
- ⚠️  **UPDATE**: Only admins can modify

## Verification

After applying the migration, run:

```bash
npm run verify-rls
```

Expected output:
```
✅ Airports: 63 visible
✅ Countries: 48 visible
✅ Airlines: 44 visible
✅ City Pairs: 72 visible
```

## Troubleshooting

### "No rows returned" but no error
This is SUCCESS! RLS policies don't return data, just create the rules.

### "Permission denied" errors
- Make sure you're logged in to Supabase Dashboard as the project owner
- Check that the SQL Editor has the correct project selected

### Data still not showing after applying
1. Verify the migration ran without errors
2. Check RLS is enabled on tables: Dashboard > Database > [table] > Policies
3. Verify user is authenticated: Check auth.users table has your user
4. Verify user_roles entry exists for your user

### Still having issues?
Run the diagnostic script:
```bash
npm run test-admin
```

This will show:
- Current user ID
- User's role
- Operator access
- Admin permissions

## Next Steps

Once RLS policies are applied:

1. ✅ Login to the app at http://localhost:3000/login
2. ✅ Navigate to Admin > Reference Data > Airports
3. ✅ You should see all 63 seeded airports
4. ✅ Navigate to other reference data pages (Countries, Airlines)
5. ✅ Verify admin operations work (edit, delete)

## Files Modified

- `supabase/migrations/005_create_rls_policies.sql` - RLS policies migration
- `scripts/setup-rls-quick.ts` - Data existence verification
- `scripts/verify-rls-policies.ts` - Post-application verification
- This guide: `RLS_SETUP_GUIDE.md`
