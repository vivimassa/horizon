# Admin System - Complete Implementation

## Overview

Complete Admin > System section with three major components:
1. **Operator Profile** - Company settings and configuration
2. **User Management** - User accounts, roles, and permissions
3. **Module Management** - Enable/disable system modules with dependency management

## Features Implemented

### ✅ 1. Operator Profile
**Company-wide settings page showing and editing:**
- Company name
- ICAO code (3 letters, optional)
- IATA code (2 alphanumeric, optional)
- Country
- Regulatory authority (FAA, EASA, CAA, etc.)
- Timezone (IANA format)
- Display of enabled modules

**Features:**
- Real-time validation
- Monospace fonts for codes
- Auto-uppercase for codes
- Success/error feedback
- Info cards showing current settings

### ✅ 2. User Management
**User administration with full CRUD:**
- List all users with:
  - Email
  - Full name
  - Role (color-coded badges)
  - Status (color-coded badges)
  - Enabled modules
  - Actions (edit/delete)

**User Roles (7 levels):**
- `super_admin` - Full system access
- `admin` - Administrative access
- `ops_controller` - Operations control
- `crew_controller` - Crew management
- `roster_planner` - Roster planning
- `crew_member` - Crew member access
- `viewer` - Read-only access

**User Statuses:**
- `active` - Full access
- `inactive` - No access
- `suspended` - Temporarily blocked

**Features:**
- Search users by email, name, or role
- Sort by any column
- Edit user role and status
- Delete users (with protection against self-deletion)
- Color-coded role and status badges
- Module access display

### ✅ 3. Module Management
**System module control with:**
- Enable/disable toggle switches
- Automatic dependency resolution
- Dependency warnings
- Module categorization (core vs addons)

**Core Modules:**
- `home` - Dashboard (always enabled)
- `network` - Network infrastructure
- `operations` - Flight operations (requires network)
- `workforce` - Crew management (requires operations)
- `reports` - Analytics and reporting
- `admin` - System administration

**Module Dependencies:**
- Operations → requires Network
- Workforce → requires Operations
- Automatic dependency enabling
- Dependency validation on disable

**Features:**
- Visual dependency tree
- Warning messages for dependency conflicts
- Automatic cascade enabling
- Prevention of breaking dependencies
- Real-time status updates

## Database Schema

### operator_profile Table
```sql
CREATE TABLE operator_profile (
  id UUID PRIMARY KEY,
  company_name TEXT NOT NULL,
  icao_code TEXT UNIQUE,
  iata_code TEXT UNIQUE,
  country TEXT NOT NULL,
  regulatory_authority TEXT NOT NULL,
  timezone TEXT NOT NULL,
  enabled_modules TEXT[] NOT NULL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### operators Table (Updated)
```sql
ALTER TABLE operators:
- role: expanded to 7 roles
- status: added (active, inactive, suspended)
```

### module_definitions Table
```sql
CREATE TABLE module_definitions (
  id UUID PRIMARY KEY,
  module_key TEXT NOT NULL UNIQUE,
  module_name TEXT NOT NULL,
  description TEXT,
  category TEXT (core | addon),
  depends_on TEXT[],
  created_at TIMESTAMPTZ
);
```

## Files Created (13 files)

### Database (1 file)
- `supabase/migrations/004_create_system_tables.sql`

### Types (1 file)
- `types/database.ts` (updated with new types and roles)

### Server Actions (3 files)
- `app/actions/operator-profile.ts`
- `app/actions/users.ts`
- `app/actions/modules.ts`

### Pages (3 files)
- `app/admin/system/operator-profile/page.tsx`
- `app/admin/system/users/page.tsx`
- `app/admin/system/modules/page.tsx`

### Components (4 files)
- `components/admin/operator-profile-form.tsx`
- `components/admin/users-table.tsx`
- `components/admin/user-edit-dialog.tsx`
- `components/admin/module-management.tsx`

### Updated Files (1 file)
- `app/admin/control/page.tsx` (added System section with 3 cards)

### UI Components Added
- `components/ui/switch.tsx` (toggle switches)

## Setup Instructions

### Step 1: Run Migration

In Supabase SQL Editor:
```sql
-- Run: supabase/migrations/004_create_system_tables.sql
```

This creates:
- `operator_profile` table with default company profile
- Updates `operators` table with expanded roles and status
- `module_definitions` table with core modules
- RLS policies for all tables

### Step 2: Update Your User to Admin

```sql
-- Update your user to super_admin
UPDATE operators
SET role = 'super_admin',
    status = 'active'
WHERE email = 'your-email@example.com';
```

### Step 3: Access System Pages

Navigate to: **http://localhost:3000/admin/control**

Click on the **System** section cards:
- **Operator Profile** - Company settings
- **User Management** - User admin
- **Module Management** - Module toggles

## Usage Guide

### Operator Profile

1. Navigate to `/admin/system/operator-profile`
2. View current company settings in info cards
3. Edit form fields:
   - Company name (required)
   - ICAO/IATA codes (optional, validated)
   - Country (required)
   - Regulatory authority (required)
   - Timezone (required, IANA format)
4. Click "Save Changes"
5. Success message appears and data refreshes

### User Management

1. Navigate to `/admin/system/users`
2. View all users in table
3. **Search** users by email, name, or role
4. **Sort** by clicking column headers
5. **Edit** user:
   - Click pencil icon
   - Update full name, role, or status
   - Save changes
6. **Delete** user:
   - Click trash icon
   - Confirm deletion
   - Cannot delete your own account

### Module Management

1. Navigate to `/admin/system/modules`
2. View all modules with current status
3. **Enable** module:
   - Toggle switch ON
   - Dependencies auto-enable
4. **Disable** module:
   - Toggle switch OFF
   - Error if other modules depend on it
5. View dependency tree at bottom

## Role Permissions

### Role Hierarchy (highest to lowest):
1. **Super Admin** - Full access, can manage admins
2. **Admin** - Administrative access, can manage users
3. **Ops Controller** - Operations management
4. **Crew Controller** - Crew management
5. **Roster Planner** - Roster planning
6. **Crew Member** - Limited operational access
7. **Viewer** - Read-only access

### Recommended Role Assignment:
- CEO/Director → Super Admin
- IT Manager → Super Admin
- Operations Manager → Ops Controller
- Crew Manager → Crew Controller
- Planners → Roster Planner
- Pilots/Crew → Crew Member
- Auditors/Observers → Viewer

## Module Dependencies

### Dependency Chain:
```
home (always enabled)
  ↓
network
  ↓
operations
  ↓
workforce
```

### Rules:
1. **Home** is always enabled (cannot be disabled)
2. **Operations** requires **Network**
3. **Workforce** requires **Operations**
4. Enabling a module auto-enables its dependencies
5. Disabling a module is blocked if others depend on it

### Example Scenarios:

**Enabling Operations:**
- Automatically enables Network
- Result: home, network, operations

**Disabling Network:**
- Error: "Cannot disable network. Operations depends on it."
- Must disable Operations and Workforce first

**Proper Disable Sequence:**
1. Disable Workforce
2. Disable Operations
3. Disable Network

## Color-Coded System

### Role Colors:
- Super Admin: Purple
- Admin: Red
- Ops Controller: Blue
- Crew Controller: Green
- Roster Planner: Yellow
- Crew Member: Gray
- Viewer: Slate

### Status Colors:
- Active: Green
- Inactive: Gray
- Suspended: Red

### Module Status:
- Enabled: Primary (blue)
- Disabled: Secondary (gray)

## Security Features

### Operator Profile:
- Admin-only access (super_admin or admin)
- ICAO/IATA code uniqueness validation
- RLS policies prevent unauthorized edits

### User Management:
- Cannot delete your own account
- Role changes require admin
- Status can suspend access immediately

### Module Management:
- Prevents breaking dependencies
- Auto-enables required modules
- Clear warning messages

## Validation Rules

### ICAO Code:
- Format: 3 uppercase letters
- Pattern: `^[A-Z]{3}$`
- Example: ABC, XYZ
- Optional but must be unique if provided

### IATA Code:
- Format: 2 uppercase alphanumeric
- Pattern: `^[A-Z0-9]{2}$`
- Example: AB, X9, 2K
- Optional but must be unique if provided

### Timezone:
- Format: IANA timezone
- Examples: America/New_York, Europe/London, Asia/Tokyo
- Must be valid timezone string

## Current Status

| Feature | Status | Access |
|---------|--------|--------|
| Operator Profile | ✅ Complete | /admin/system/operator-profile |
| User Management | ✅ Complete | /admin/system/users |
| Module Management | ✅ Complete | /admin/system/modules |

## Testing Checklist

### Operator Profile:
- [ ] View company info cards
- [ ] Edit company name
- [ ] Set ICAO/IATA codes
- [ ] Change country and authority
- [ ] Update timezone
- [ ] Save and verify success message

### User Management:
- [ ] View all users
- [ ] Search users
- [ ] Sort by different columns
- [ ] Edit user role
- [ ] Change user status
- [ ] Try to delete own account (should fail)
- [ ] Delete another user

### Module Management:
- [ ] View module status
- [ ] Enable Operations (should enable Network)
- [ ] Enable Workforce (should enable Operations and Network)
- [ ] Try to disable Network while Operations enabled (should fail)
- [ ] Disable modules in correct order
- [ ] View dependency warnings

## Next Steps

The Admin System is now complete! You can:

1. ✅ Customize company profile
2. ✅ Manage user accounts and roles
3. ✅ Control which modules are enabled
4. ✅ Enforce module dependencies

Consider adding:
- Audit log for admin actions
- Bulk user import/export
- Custom role permissions
- Module-specific settings
- Email notifications for user changes

All system administration features are now fully functional! 🎉
