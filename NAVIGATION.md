# Navigation System Documentation

## Overview

The Horizon navigation system features an Apple-style dock at the bottom of the screen with breadcrumb navigation and module-based access control.

## Components

### 1. Dock Navigation (`components/navigation/dock.tsx`)

**Features:**
- Fixed bottom dock with Apple-style design
- H logo for HORIZON branding
- Module icons: Home, Network, Operations, Workforce, Reports, Admin
- Active state highlighting
- Tooltips for all items
- Admin icon grayed out for non-admin users with "Administrator access required" tooltip
- Module access based on `operators.enabled_modules`

**Usage:**
The dock is automatically included in the root layout and appears on all authenticated pages.

### 2. Breadcrumb Navigation (`components/navigation/breadcrumb-nav.tsx`)

**Features:**
- Dynamic breadcrumbs based on current route
- Home icon for root
- Automatic segment parsing
- Links to parent routes
- Current page highlighted

**Usage:**
Automatically included in the root layout, displays above page content.

### 3. Module Tabs (`components/navigation/module-tabs.tsx`)

**Features:**
- Three tabs per module: Control, Tools, Reports
- Icons for each tab
- Active state highlighting
- Automatic routing

**Usage:**
```tsx
<ModuleTabs moduleBase="/network" moduleName="Network" />
```

### 4. Module Guard (`components/guards/module-guard.tsx`)

**Features:**
- Server-side access control
- Checks `operators.enabled_modules`
- Admin-only module protection
- Access denied screen for unauthorized users
- Optional redirect to home

**Usage:**
```tsx
<ModuleGuard module="network">
  {children}
</ModuleGuard>
```

## Module Structure

Each module follows this structure:

```
app/
├── network/
│   ├── layout.tsx          # Module layout with guard and tabs
│   ├── page.tsx            # Redirects to /control
│   ├── control/
│   │   └── page.tsx        # Control tab content
│   ├── tools/
│   │   └── page.tsx        # Tools tab content
│   └── reports/
│       └── page.tsx        # Reports tab content
```

## Access Control

### Operators Table

The `operators` table stores user permissions:

```sql
CREATE TABLE operators (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT ('admin' | 'operator' | 'viewer'),
  enabled_modules TEXT[],  -- Array of module names
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Module Access Rules

1. **Home**: Always accessible to authenticated users
2. **Network, Operations, Workforce, Reports**: Accessible if in `enabled_modules`
3. **Admin**: Only accessible to users with `role = 'admin'`

### Helper Functions (`lib/operators.ts`)

- `getCurrentOperator()`: Fetch current user's operator record
- `hasModuleAccess(operator, module)`: Check if operator can access module
- `getAccessibleModules(operator)`: Get list of all accessible modules
- `isAdmin(operator)`: Check if operator is admin

## Setup Instructions

### 1. Run Database Migration

Execute the SQL migration in your Supabase project:

```bash
# In Supabase SQL Editor, run:
supabase/migrations/001_create_operators_table.sql
```

### 2. Create Your First Admin

After registering your first user, update the operators table:

```sql
UPDATE operators
SET role = 'admin',
    enabled_modules = ARRAY['home', 'network', 'operations', 'workforce', 'reports', 'admin']::TEXT[]
WHERE email = 'your-email@example.com';
```

### 3. Default New User Access

New users automatically get these modules:
- network
- operations
- workforce
- reports

Admins can modify access through the Admin module (to be implemented).

## Customization

### Adding a New Module

1. **Update Types** (`types/database.ts`):
```typescript
export type ModuleName = 'home' | 'network' | 'operations' | 'workforce' | 'reports' | 'admin' | 'newmodule'
```

2. **Add to Dock** (`components/navigation/dock.tsx`):
```typescript
{
  id: 'newmodule',
  label: 'New Module',
  icon: YourIcon,
  path: '/newmodule',
}
```

3. **Create Module Structure**:
```
app/newmodule/
├── layout.tsx
├── page.tsx
├── control/page.tsx
├── tools/page.tsx
└── reports/page.tsx
```

### Changing Module Tabs

Edit `components/navigation/module-tabs.tsx` to customize tab labels, icons, or add/remove tabs.

### Styling the Dock

The dock uses Tailwind CSS and can be customized in `components/navigation/dock.tsx`. Key classes:
- Container: `rounded-2xl border bg-background/95 backdrop-blur`
- Icons: `h-12 w-12 rounded-xl`
- Active state: `bg-primary text-primary-foreground scale-105`
- Disabled: `bg-muted/50 text-muted-foreground/30`

## Testing

1. **Register** a new user at `/register`
2. **Login** and verify you see the dock
3. **Navigate** to modules you have access to
4. **Try accessing** Admin module (should show access denied)
5. **Update** your role to admin in Supabase
6. **Verify** Admin icon is now accessible
