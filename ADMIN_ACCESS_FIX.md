# Admin Access Fix ✅

## Problem Identified

The admin section was blocked because:

1. **Wrong table lookup**: `lib/operators.ts` was trying to query the `operators` table with `user_id` column (which doesn't exist)
2. **Wrong role source**: Code was checking for `operator.role` in the operators table, but roles are stored in the `user_roles` table
3. **Missing super_admin check**: Admin access only checked for `role === 'admin'`, not `super_admin`

## What Was Fixed

### 1. Rewrote `lib/operators.ts`

**Before:**
```typescript
// Tried to get operator with user_id (doesn't exist)
const { data: operator } = await supabase
  .from('operators')
  .select('*')
  .eq('user_id', user.id)  // ❌ This column doesn't exist!
  .single()

// Checked wrong role location
if (module === 'admin') {
  return operator.role === 'admin'  // ❌ Role is not in operators table!
}
```

**After:**
```typescript
// Get operator (company profile)
const { data: operator } = await adminClient
  .from('operators')
  .select('*')
  .limit(1)
  .maybeSingle()

// Get user's role from user_roles table
const { data: userRole } = await adminClient
  .from('user_roles')
  .select('id, role, operator_id')
  .eq('user_id', user.id)
  .eq('operator_id', operator.id)
  .maybeSingle()

// Combine into OperatorWithRole
return {
  ...operator,
  user_role: userRole?.role || null,
  user_role_id: userRole?.id || null
}

// Check admin access correctly
if (module === 'admin') {
  return operator.user_role === 'admin' || operator.user_role === 'super_admin'
}
```

### 2. Created New Type: `OperatorWithRole`

```typescript
export interface OperatorWithRole {
  // Company operator fields
  id: string
  code: string
  iata_code: string | null
  name: string
  country: string
  regulatory_authority: string
  timezone: string
  enabled_modules: string[]
  created_at: string
  updated_at: string
  // User-specific role from user_roles table
  user_role?: string | null
  user_role_id?: string | null
}
```

### 3. Updated Access Functions

- `hasModuleAccess()` - Now checks `user_role` for admin access
- `getAccessibleModules()` - Includes admin module for super_admin
- `isAdmin()` - Returns true for both admin and super_admin
- `isSuperAdmin()` - New function to check specifically for super_admin

### 4. Updated Components

**Files modified:**
- `lib/operators.ts` - Complete rewrite
- `app/layout.tsx` - Import OperatorWithRole type
- `components/navigation/dock.tsx` - Use OperatorWithRole type

## Schema Clarification

### operators table
Company-wide profile (single row):
- `id`, `code`, `iata_code`, `name`, `country`, etc.
- **No `user_id` column**
- **No `role` column**

### user_roles table
Individual user permissions (one row per user):
- `id`, `user_id` (FK to auth.users), `operator_id` (FK to operators)
- **`role`** - 'super_admin', 'admin', 'user', etc.

### Relationship
```
auth.users (Supabase auth)
    ↓ (user_id)
user_roles (permissions)
    ↓ (operator_id)
operators (company profile)
```

## Testing

Run the test to verify admin access:

```bash
npm run test-admin
```

Expected output:
```
✅ User ID: d3986b35-cf4d-4606-b4c4-fb510d6f5f42
✅ Operator: Horizon Airlines
✅ User role: super_admin

📋 Access checks:
   Has admin module access: true
   Is admin: true
   Is super admin: true
```

## Result

✅ **Admin access now works!**

User `vivimassa@live.com` with `super_admin` role can now access:
- `/admin` - Admin home
- `/admin/control` - Control panel
- `/admin/system/modules` - Module management
- `/admin/system/operator-profile` - Operator profile
- `/admin/system/users` - User management
- `/admin/reference-data/countries` - Countries management
- `/admin/reference-data/airports` - Airports management
- `/admin/reports` - Admin reports
- `/admin/tools` - Admin tools

## Next Steps

1. **Login** at http://localhost:3000/login
2. **Navigate to Admin** via the dock (shield icon) or URL
3. **Access all admin sections** without restrictions

All admin pages should now be accessible!

