# Airports Reference Data - Setup Guide

## Overview

The Airports reference data management system allows administrators to maintain a comprehensive database of airports worldwide with ICAO codes, IATA codes, and timezone information.

## Features

✅ **Searchable Data Table** - Search by ICAO, IATA, name, city, or country
✅ **Sortable Columns** - Click column headers to sort ascending/descending
✅ **Add Airport** - Modal form to add new airports
✅ **Edit Airport** - Update existing airport information
✅ **Delete Airport** - Remove airports with confirmation
✅ **Monospace Codes** - ICAO/IATA codes displayed in monospace font
✅ **Validation** - ICAO (4 letters), IATA (3 letters) code validation
✅ **IANA Timezones** - Standard timezone support
✅ **200+ Airports** - Pre-seeded with real airport data

## Setup Instructions

### Step 1: Run Database Migrations

Execute the following SQL files in your Supabase SQL Editor:

**1. Create airports table:**
```sql
-- Run: supabase/migrations/002_create_airports_table.sql
```

This creates:
- `airports` table with proper schema
- Indexes on ICAO, IATA, country, city
- Row-level security policies
- Admin-only insert/update/delete policies

**2. Seed airport data:**
```sql
-- Run: supabase/seeds/airports_seed.sql
```

This inserts 200+ airports including:
- Major US airports (JFK, LAX, ORD, etc.)
- European hubs (LHR, CDG, FRA, etc.)
- Asian airports (NRT, SIN, HKG, etc.)
- Australian/Pacific airports
- Middle Eastern airports
- African airports
- South American airports

### Step 2: Verify Database Setup

Check that the airports table was created:

```sql
SELECT COUNT(*) FROM airports;
-- Should return 200+ rows

SELECT * FROM airports LIMIT 10;
-- Should show airport data
```

### Step 3: Access the Feature

1. Make sure you're logged in as an **admin user**
2. Navigate to: **http://localhost:3000/admin/control**
3. Click on **"Manage Airports"** under Reference Data
4. You'll see the airports data table

## Using the Airports Feature

### Search Airports

Use the search box to filter by:
- ICAO code (e.g., "KJFK")
- IATA code (e.g., "JFK")
- Airport name (e.g., "Kennedy")
- City (e.g., "New York")
- Country (e.g., "United States")

### Sort Airports

Click any column header to sort:
- First click: Sort ascending
- Second click: Sort descending
- Columns: ICAO, IATA, Airport Name, City, Country, Timezone

### Add New Airport

1. Click **"Add Airport"** button
2. Fill in the form:
   - **ICAO Code** (required): 4 uppercase letters (e.g., KJFK)
   - **IATA Code** (optional): 3 uppercase letters (e.g., JFK)
   - **Airport Name** (required): Full name
   - **City** (required): City name
   - **Country** (required): Country name
   - **Timezone** (required): IANA timezone (e.g., America/New_York)
3. Click **"Add Airport"**

**Tips:**
- ICAO codes are automatically converted to uppercase
- IATA codes are optional (some airports don't have them)
- Use proper IANA timezone format (Region/City)
- ICAO codes must be unique

### Edit Airport

1. Click the **pencil icon** in the Actions column
2. Update the fields
3. Click **"Update Airport"**

### Delete Airport

1. Click the **trash icon** in the Actions column
2. Confirm deletion in the dialog
3. Airport is permanently removed

## Field Reference

| Field | Format | Required | Example | Notes |
|-------|--------|----------|---------|-------|
| ICAO Code | 4 letters | Yes | KJFK | Unique, uppercase |
| IATA Code | 3 letters | No | JFK | Uppercase, optional |
| Airport Name | Text | Yes | John F. Kennedy International Airport | Full official name |
| City | Text | Yes | New York | Primary city served |
| Country | Text | Yes | United States | Full country name |
| Timezone | IANA | Yes | America/New_York | Must be valid IANA timezone |

## Common IANA Timezones

**Americas:**
- `America/New_York` - Eastern Time (US)
- `America/Chicago` - Central Time (US)
- `America/Denver` - Mountain Time (US)
- `America/Los_Angeles` - Pacific Time (US)
- `America/Toronto` - Eastern Time (Canada)
- `America/Mexico_City` - Mexico
- `America/Sao_Paulo` - Brazil

**Europe:**
- `Europe/London` - UK
- `Europe/Paris` - France, Spain (most)
- `Europe/Berlin` - Germany, Netherlands
- `Europe/Rome` - Italy
- `Europe/Moscow` - Russia (Western)

**Asia:**
- `Asia/Tokyo` - Japan
- `Asia/Shanghai` - China
- `Asia/Hong_Kong` - Hong Kong
- `Asia/Singapore` - Singapore
- `Asia/Dubai` - UAE
- `Asia/Kolkata` - India
- `Asia/Bangkok` - Thailand

**Oceania:**
- `Australia/Sydney` - Sydney
- `Australia/Melbourne` - Melbourne
- `Pacific/Auckland` - New Zealand

**Africa:**
- `Africa/Johannesburg` - South Africa
- `Africa/Cairo` - Egypt
- `Africa/Nairobi` - Kenya

## Validation Rules

### ICAO Code
- **Format**: Exactly 4 uppercase letters
- **Example**: KJFK, EGLL, RJTT
- **Validation**: `^[A-Z]{4}$`
- **Must be unique**

### IATA Code
- **Format**: Exactly 3 uppercase letters (optional)
- **Example**: JFK, LHR, NRT
- **Validation**: `^[A-Z]{3}$`
- **Can be empty** (not all airports have IATA codes)

### Timezone
- Must be a valid IANA timezone
- Format: `Region/City` or `Region/Country/City`
- Case-sensitive
- Examples: `America/New_York`, `Europe/London`, `Asia/Tokyo`

## File Structure

```
app/
├── actions/
│   └── airports.ts                 # Server actions (CRUD)
├── admin/
│   ├── control/page.tsx           # Admin dashboard with links
│   └── reference-data/
│       └── airports/
│           └── page.tsx           # Airports page
components/
└── admin/
    ├── airports-table.tsx         # Data table with search/sort
    └── airport-form-dialog.tsx    # Add/Edit modal
supabase/
├── migrations/
│   └── 002_create_airports_table.sql  # Table schema
└── seeds/
    └── airports_seed.sql              # 200+ airports data
```

## API Reference

### Server Actions (`app/actions/airports.ts`)

**`getAirports(): Promise<Airport[]>`**
- Fetches all airports
- Sorted by ICAO code
- Used by the airports page

**`createAirport(formData: FormData)`**
- Creates a new airport
- Validates ICAO/IATA format
- Returns `{ error: string }` or `{ success: true }`

**`updateAirport(id: string, formData: FormData)`**
- Updates an existing airport
- Validates ICAO/IATA format
- Returns `{ error: string }` or `{ success: true }`

**`deleteAirport(id: string)`**
- Deletes an airport by ID
- Admin-only via RLS policies
- Returns `{ error: string }` or `{ success: true }`

## Troubleshooting

### "Access Denied" when accessing /admin/reference-data/airports

**Cause**: You're not logged in as an admin.

**Solution**:
```sql
UPDATE operators
SET role = 'admin'
WHERE email = 'your-email@example.com';
```

### ICAO code already exists error

**Cause**: Trying to create/update with a duplicate ICAO code.

**Solution**: ICAO codes must be unique. Use a different code or edit the existing airport.

### Invalid timezone error

**Cause**: Using incorrect timezone format.

**Solution**: Use proper IANA format like `America/New_York`, not `EST` or `Eastern`.

### Airports not showing up

**Cause**: Seed data not loaded.

**Solution**: Run `supabase/seeds/airports_seed.sql` in Supabase SQL Editor.

## Extending the Feature

### Add More Airports

Use the "Add Airport" button or insert via SQL:

```sql
INSERT INTO airports (icao_code, iata_code, airport_name, city, country, timezone)
VALUES ('KJFK', 'JFK', 'John F. Kennedy International Airport', 'New York', 'United States', 'America/New_York');
```

### Export Airports Data

```sql
COPY (SELECT * FROM airports ORDER BY icao_code)
TO '/path/to/airports_export.csv'
WITH CSV HEADER;
```

### Add Bulk Import

Create a server action that accepts CSV/JSON and inserts multiple airports.

### Add More Fields

Extend the schema with:
- Latitude/longitude coordinates
- Elevation
- Runway information
- Airport type (international, regional, etc.)
- Status (active, closed, etc.)

## Next Steps

1. ✅ Airports data is now ready
2. Consider adding:
   - Aircraft types reference data
   - Airlines reference data
   - Airport facilities/services
   - Runway information
   - Weather station codes

## Support

The airports feature is fully functional and ready to use. Access it at:
**Admin > Control > Reference Data > Manage Airports**

Or directly at:
**http://localhost:3000/admin/reference-data/airports**
