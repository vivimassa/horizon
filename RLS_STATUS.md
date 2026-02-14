# RLS Status & Next Steps

## Current Status ✅

### What's Working:
- ✅ Database seeded with reference data:
  - 63 airports (Vietnam, ASEAN, global hubs)
  - 48 countries (ASEAN, major global)
  - 44 airlines (full carriers, LCCs)
  - 72 city pairs (from SGN and HAN)
- ✅ Operator created (HZN - Horizon Airlines)
- ✅ User linked as super_admin (vivimassa@live.com)
- ✅ User preferences created
- ✅ Admin access fixed (can access /admin sections)
- ✅ RLS policies migration created

### What's Not Working:
- ❌ RLS policies NOT YET APPLIED
- ❌ Data not visible to authenticated users
- ❌ Airports page shows 0 results (RLS blocking)

## Problem Explained

Row Level Security (RLS) is **enabled** on all tables, but **no policies exist** yet. This means:
- Service role (admin client) CAN see data ✅
- Authenticated users CANNOT see data ❌
- The app appears empty even though data exists

## Solution: Apply RLS Policies

You need to apply the migration file that contains all the RLS policies.

### Quick Steps:

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your Horizon project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy & Paste Migration**
   - Open: `C:\Users\vivim\horizon\supabase\migrations\005_create_rls_policies.sql`
   - Select ALL (Ctrl+A)
   - Copy (Ctrl+C)
   - Paste into SQL Editor (Ctrl+V)

4. **Run the SQL**
   - Click "Run" button (or press Ctrl+Enter)
   - Wait for "Success. No rows returned" message
   - This is NORMAL - policies don't return data

5. **Verify It Worked**
   ```bash
   npm run verify-rls
   ```

## What the Migration Does

### Helper Functions (for policy logic):
```sql
is_admin() - Checks if user has 'admin' or 'super_admin' role
get_user_operator_id() - Gets user's operator_id from user_roles
```

### Reference Data Policies:
**Tables: countries, airports, airlines, city_pairs**

| Action | Who Can Do It | Policy |
|--------|---------------|--------|
| SELECT (read) | All authenticated users | `USING (true)` |
| INSERT (create) | Only admins | `WITH CHECK (is_admin())` |
| UPDATE (edit) | Only admins | `USING (is_admin())` |
| DELETE (remove) | Only admins | `USING (is_admin())` |

### Operator-Scoped Data Policies:
**Tables: aircraft_types**

| Action | Who Can Do It | Policy |
|--------|---------------|--------|
| SELECT | Users of same operator | `operator_id = get_user_operator_id()` |
| INSERT | Admins of same operator | `operator_id = get_user_operator_id() AND is_admin()` |
| UPDATE | Admins of same operator | Same as INSERT |
| DELETE | Admins of same operator | Same as INSERT |

### User Data Policies:
**Tables: user_roles, user_preferences**

| Action | Who Can Do It | Policy |
|--------|---------------|--------|
| SELECT | Own records + admins see all | `user_id = auth.uid() OR is_admin()` |
| INSERT | Only admins | `is_admin()` |
| UPDATE | Only admins | `is_admin()` |
| DELETE | Only admins | `is_admin()` |

### Operators Table Policies:

| Action | Who Can Do It | Policy |
|--------|---------------|--------|
| SELECT | All authenticated users | `USING (true)` |
| UPDATE | Only admins | `is_admin()` |

## Expected Outcome

After applying the migration, you should be able to:

1. ✅ Login at http://localhost:3000/login
2. ✅ See all reference data in the app:
   - Admin > Reference Data > Airports (63 airports)
   - Admin > Reference Data > Countries (48 countries)
   - Admin > Reference Data > Airlines (44 airlines)
   - Admin > Reference Data > City Pairs (72 city pairs)
3. ✅ As super_admin, you can:
   - View all data
   - Edit records
   - Delete records
   - Create new records
4. ✅ Regular users can:
   - View all reference data
   - NOT edit/delete (admin only)

## Verification Commands

```bash
# Verify data exists (uses service role)
npm run setup-rls

# Verify policies work (uses authenticated user)
npm run verify-rls

# Test admin access
npm run test-admin
```

## Troubleshooting

### Migration fails with "function already exists"
This is OK! It means some policies were already created. Continue anyway.

### Still showing 0 airports after applying
1. Hard refresh the browser (Ctrl+Shift+R)
2. Check browser console for errors
3. Run `npm run verify-rls` to diagnose
4. Check Supabase logs in Dashboard > Logs

### "Permission denied" errors in SQL Editor
- Make sure you're logged into Supabase Dashboard
- Ensure you're the project owner
- Try using the CLI instead: `supabase db push` (if installed)

## Files Created

- ✅ `supabase/migrations/005_create_rls_policies.sql` - The migration to apply
- ✅ `scripts/setup-rls-quick.ts` - Verifies data exists
- ✅ `scripts/verify-rls-policies.ts` - Tests policies after applying
- ✅ `RLS_SETUP_GUIDE.md` - Detailed step-by-step guide
- ✅ `RLS_STATUS.md` - This file (current status)

## Next Steps

1. **Apply the RLS migration** (follow steps above)
2. **Run verification**: `npm run verify-rls`
3. **Test in browser**: Navigate to Admin > Reference Data > Airports
4. **Verify counts**:
   - Airports: 63
   - Countries: 48
   - Airlines: 44
   - City Pairs: 72

## Need Help?

Read the detailed guide: `RLS_SETUP_GUIDE.md`

Or check the migration file directly: `supabase/migrations/005_create_rls_policies.sql`

---

**Current Time:** Ready to apply RLS policies
**Dev Server:** Running at http://localhost:3000
**Next Action:** Apply the migration in Supabase Dashboard
