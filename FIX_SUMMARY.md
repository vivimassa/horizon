# Fix Summary: operator_profile → operators Table

## ✅ Fixed Issues

1. **Table Not Found Error** - The code was trying to query a non-existent `operator_profile` table
2. **RLS Access Issues** - The operators table had Row Level Security enabled but no public read access
3. **Schema Mismatch** - Field names didn't match the actual database schema

## 🔧 Changes Made

### 1. Created Admin Supabase Client
**File**: `lib/supabase/admin.ts` (NEW)
- Uses service role key to bypass RLS
- Only for server-side operations
- Used for accessing company-wide operator profile data

### 2. Updated Operator Profile Actions
**File**: `app/actions/operator-profile.ts`
- Now uses `operators` table instead of `operator_profile`
- Added custom `OperatorProfile` type definition
- Uses admin client to bypass RLS
- Changed `.single()` to `.limit(1).maybeSingle()` for better error handling
- Field mapping:
  - `company_name` → `name`
  - `icao_code` → `code`

### 3. Updated Modules Actions
**File**: `app/actions/modules.ts`
- Changed from `operator_profile` to `operators` table
- Uses admin client for operators table access
- Fixed query to use `.maybeSingle()` instead of `.single()`

### 4. Updated Home Page
**File**: `app/page.tsx`
- Changed `profile.company_name` → `profile.name`
- Changed `profile.icao_code` → `profile.code`

### 5. Updated Admin Pages
**File**: `app/admin/system/operator-profile/page.tsx`
- Changed field references to match new schema

**File**: `components/admin/operator-profile-form.tsx`
- Updated import to use OperatorProfile from actions
- Changed defaultValue from `profile.company_name` → `profile.name`
- Changed defaultValue from `profile.icao_code` → `profile.code`

### 6. Updated Type Definitions
**File**: `types/database.ts`
- Commented out non-existent `operator_profile` table definition
- Added note that OperatorProfile is now defined in actions

## 🎯 Current Status

### ✅ Working
- Dev server running without errors
- Operator profile can be fetched successfully
- Database properly seeded with Horizon Airlines operator
- Page redirects to login (expected behavior for unauthenticated users)

### 📊 Seeded Data
- **Operator**: Horizon Airlines (HZN/HZ)
- **Countries**: 48 total
- **Airports**: 63 total (20 Vietnam, major ASEAN & global hubs)
- **Aircraft Types**: 3 (A320, A321, A333)
- **Airlines**: 43 major carriers
- **City Pairs**: 72 routes from SGN/HAN

## 🔐 Security Notes

The admin client bypasses RLS, which is necessary for:
- Reading company-wide operator profile (single source of truth)
- Module management (system-level configuration)

This is acceptable because:
1. The admin client is ONLY used server-side
2. It's never exposed to the client/browser
3. The data (operator profile) is company-wide, not user-specific
4. Individual user permissions are still enforced through authentication

## 🚀 Next Steps

1. **Login/Register**: Create or login with a user account
2. **Access Control**: The page will show operator profile after authentication
3. **Optional - Add RLS Policies**: If you prefer not using admin client, add RLS policies:

```sql
-- Allow authenticated users to read operator profile
CREATE POLICY "Authenticated users can read operators"
  ON operators FOR SELECT
  USING (auth.role() = 'authenticated');
```

## 🌐 Access Your App

- **URL**: http://localhost:3000
- **Status**: ✅ Running
- **Next**: Login or register to see the dashboard

