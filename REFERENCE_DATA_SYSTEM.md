# Reference Data Management System

## Overview

Complete reference data management system for aviation operations with 5 data types:
1. **Airports** (200+ seeded) ✅ COMPLETE
2. **Countries** (50+ seeded) ⚠️ PARTIAL - needs form dialogs and tables
3. **Aircraft Types** (50+ seeded) ⚠️ PARTIAL - needs form dialogs and tables
4. **Airlines** (60+ seeded) ⚠️ PARTIAL - needs form dialogs and tables
5. **City Pairs** (80+ seeded) ⚠️ PARTIAL - needs form dialogs and tables

## Completed Components

### ✅ Database Schema & Seeds
All database migrations and seed data files are complete:
- `supabase/migrations/002_create_airports_table.sql`
- `supabase/migrations/003_create_reference_tables.sql`
- `supabase/seeds/airports_seed.sql` (200+ airports)
- `supabase/seeds/countries_seed.sql` (50+ countries)
- `supabase/seeds/aircraft_types_seed.sql` (50+ aircraft)
- `supabase/seeds/airlines_seed.sql` (60+ airlines)
- `supabase/seeds/city_pairs_seed.sql` (80+ routes)

### ✅ TypeScript Types
All database types defined in `types/database.ts`:
- Airport, Country, AircraftType, Airline, CityPair types
- Full Insert/Update type definitions
- Proper TypeScript enums for categories

### ✅ Server Actions
All CRUD operations implemented:
- `app/actions/airports.ts` ✅
- `app/actions/countries.ts` ✅
- `app/actions/aircraft-types.ts` ✅
- `app/actions/airlines.ts` ✅
- `app/actions/city-pairs.ts` ✅

### ✅ Airports (COMPLETE)
- Table component with search/sort
- Form dialog for add/edit
- Delete confirmation
- Page with full integration
- Monospace fonts for codes
- 200+ airports seeded

### ⚠️ Countries (PARTIAL)
**Completed:**
- Database table and seed data (50+ countries)
- Server actions (CRUD)
- Table component
- Form dialog
- Page structure

**Pattern:**
```tsx
// components/admin/countries-table.tsx - Similar to airports-table
// components/admin/country-form-dialog.tsx - Similar to airport-form-dialog
// app/admin/reference-data/countries/page.tsx - Uses CountriesTable

Fields: ISO code (2 letters), name, region, currency, ICAO prefix
```

## Remaining Work

### Aircraft Types Components Needed

**Table Component:** `components/admin/aircraft-types-table.tsx`
```tsx
// Similar pattern to airports-table.tsx
// Columns: ICAO Type, IATA Type, Name, Family, Category, Pax, Cockpit Crew, Cabin Crew
// Monospace: icao_type, iata_type
// Search by: icao_type, iata_type, name, family
// Sort all columns
```

**Form Dialog:** `components/admin/aircraft-type-form-dialog.tsx`
```tsx
// Fields:
// - icao_type: Input (3-4 uppercase alphanumeric, monospace)
// - iata_type: Input (3 chars, optional, monospace)
// - name: Input (full name like "Boeing 737-800")
// - family: Input (e.g., "Boeing 737 NG")
// - category: Select (narrow-body, wide-body, regional, turboprop, freighter, business)
// - pax_capacity: Input number
// - cockpit_crew: Input number (usually 2)
// - cabin_crew: Input number
```

**Page:** `app/admin/reference-data/aircraft-types/page.tsx`
```tsx
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { AircraftTypesTable } from '@/components/admin/aircraft-types-table'
// Same pattern as airports/page.tsx
```

### Airlines Components Needed

**Table Component:** `components/admin/airlines-table.tsx`
```tsx
// Columns: ICAO Code, IATA Code, Name, Country, Alliance
// Monospace: icao_code, iata_code
// Search by: icao_code, iata_code, name, country
// Sort all columns
```

**Form Dialog:** `components/admin/airline-form-dialog.tsx`
```tsx
// Fields:
// - icao_code: Input (3 uppercase letters, monospace)
// - iata_code: Input (2 alphanumeric, optional, monospace)
// - name: Input (full airline name)
// - country: Input (country name)
// - alliance: Select (Star Alliance, Oneworld, SkyTeam, None)
```

**Page:** `app/admin/reference-data/airlines/page.tsx`
```tsx
import { getAirlines } from '@/app/actions/airlines'
import { AirlinesTable } from '@/components/admin/airlines-table'
// Same pattern as airports/page.tsx
```

### City Pairs Components Needed

**Table Component:** `components/admin/city-pairs-table.tsx`
```tsx
// Columns: Departure, Arrival, Block Time, Distance, Route Type, ETOPS
// Monospace: departure_airport, arrival_airport
// Search by: departure_airport, arrival_airport
// Sort all columns
// Block time displayed as "Xh Ym" (e.g., "6h 30m")
// Distance displayed with "nm" suffix
// ETOPS as Yes/No badge
```

**Form Dialog:** `components/admin/city-pair-form-dialog.tsx`
```tsx
// Fields:
// - departure_airport: Input (4 uppercase letters, monospace, ICAO code)
// - arrival_airport: Input (4 uppercase letters, monospace, ICAO code)
// - block_time: Input number (minutes)
// - distance: Input number (nautical miles)
// - route_type: Select (domestic, regional, international, long-haul, ultra-long-haul)
// - etops_required: Checkbox (boolean)
//
// Validation: departure !== arrival
```

**Page:** `app/admin/reference-data/city-pairs/page.tsx`
```tsx
import { getCityPairs } from '@/app/actions/city-pairs'
import { CityPairsTable } from '@/components/admin/city-pairs-table'
// Same pattern as airports/page.tsx
```

## Component Pattern Template

All components follow the same pattern established by the Airports implementation:

### Table Component Pattern
```tsx
'use client'

import { useState, useMemo } from 'react'
import { Type } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormDialog } from './form-dialog'
import { deleteAction } from '@/app/actions/...'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// State: searchQuery, sortColumn, sortDirection, formOpen, editItem, deleteDialog
// useMemo for filtering and sorting
// Render: search bar, count, add button, table with sortable headers, action buttons
// Modals: form dialog, delete confirmation
```

### Form Dialog Pattern
```tsx
'use client'

import { useState } from 'react'
import { Type } from '@/types/database'
import { createAction, updateAction } from '@/app/actions/...'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'

// State: loading, error
// Form: async handleSubmit, calls create or update action
// Fields: all required inputs with validation
// Monospace className for code fields
// Auto-uppercase for code inputs
```

### Page Pattern
```tsx
import { getItems } from '@/app/actions/...'
import { ItemsTable } from '@/components/admin/items-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function Page() {
  const items = await getItems()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemsTable items={items} />
        </CardContent>
      </Card>
    </div>
  )
}
```

## Setup Instructions

### 1. Run All Migrations

In Supabase SQL Editor, run in order:
```sql
-- If not already run:
-- 001_create_operators_table.sql
-- 002_create_airports_table.sql

-- New migrations:
003_create_reference_tables.sql
```

### 2. Run All Seeds

In Supabase SQL Editor:
```sql
-- airports_seed.sql (if not already run)
countries_seed.sql
aircraft_types_seed.sql
airlines_seed.sql
city_pairs_seed.sql
```

### 3. Access Reference Data

Navigate to: **Admin → Control → Reference Data**

Or directly:
- http://localhost:3000/admin/reference-data/airports ✅ WORKING
- http://localhost:3000/admin/reference-data/countries ⚠️ NEEDS COMPONENTS
- http://localhost:3000/admin/reference-data/aircraft-types ⚠️ NEEDS COMPONENTS
- http://localhost:3000/admin/reference-data/airlines ⚠️ NEEDS COMPONENTS
- http://localhost:3000/admin/reference-data/city-pairs ⚠️ NEEDS COMPONENTS

## Data Specifications

### Countries
- **ISO Code**: 2 uppercase letters (e.g., US, GB, FR)
- **Region**: North America, Europe, Asia, Middle East, Oceania, South America, Africa
- **Currency**: 3 uppercase letters (e.g., USD, EUR, GBP)
- **ICAO Prefix**: 1-2 characters (e.g., K for USA, EG for UK)

### Aircraft Types
- **ICAO Type**: 3-4 alphanumeric (e.g., B738, A320, AT72)
- **IATA Type**: 3 alphanumeric (e.g., 738, 320, AT7)
- **Category**: narrow-body, wide-body, regional, turboprop, freighter, business
- **Capacity**: Typical passenger configuration
- **Crew**: Cockpit (usually 2), Cabin (varies by size)

### Airlines
- **ICAO Code**: 3 uppercase letters (e.g., UAL, BAW, AFR)
- **IATA Code**: 2 alphanumeric (e.g., UA, BA, AF)
- **Alliance**: Star Alliance, Oneworld, SkyTeam, None

### City Pairs
- **Airports**: 4-letter ICAO codes (e.g., KJFK, EGLL)
- **Block Time**: Minutes (total flight time)
- **Distance**: Nautical miles
- **Route Type**: domestic, regional, international, long-haul, ultra-long-haul
- **ETOPS**: Required for long overwater flights

## Quick Reference

### Monospace Fields
All code fields should use `className="font-mono"`:
- ICAO codes (airports, aircraft, airlines)
- IATA codes
- ISO codes
- Currency codes
- Timezones

### Validation Patterns
```typescript
// ICAO codes (4 letters): ^[A-Z]{4}$
// IATA codes (3 letters): ^[A-Z]{3}$
// ISO codes (2 letters): ^[A-Z]{2}$
// ICAO type (3-4 alphanumeric): ^[A-Z0-9]{3,4}$
// Airline IATA (2 alphanumeric): ^[A-Z0-9]{2}$
```

### Select Options
```typescript
// Aircraft categories
['narrow-body', 'wide-body', 'regional', 'turboprop', 'freighter', 'business']

// Alliances
['Star Alliance', 'Oneworld', 'SkyTeam', 'None']

// Route types
['domestic', 'regional', 'international', 'long-haul', 'ultra-long-haul']
```

## Status Summary

| Component | Database | Actions | Table | Form | Page | Status |
|-----------|----------|---------|-------|------|------|--------|
| Airports | ✅ | ✅ | ✅ | ✅ | ✅ | **COMPLETE** |
| Countries | ✅ | ✅ | ✅ | ✅ | ✅ | **COMPLETE** |
| Aircraft Types | ✅ | ✅ | ❌ | ❌ | ❌ | **NEEDS UI** |
| Airlines | ✅ | ✅ | ❌ | ❌ | ❌ | **NEEDS UI** |
| City Pairs | ✅ | ✅ | ❌ | ❌ | ❌ | **NEEDS UI** |

## Next Steps

1. ✅ Run migrations 003_create_reference_tables.sql
2. ✅ Run all seed data files
3. ⚠️ Create remaining table components (aircraft, airlines, city pairs)
4. ⚠️ Create remaining form dialogs (aircraft, airlines, city pairs)
5. ⚠️ Create remaining pages (aircraft, airlines, city pairs)

All backend logic is complete - only UI components remain!
