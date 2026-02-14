# Database Seeding Summary

## Successfully Seeded Data

### ✅ Completed

1. **Operator (Company Profile)**
   - Code: HZN
   - IATA Code: HZ
   - Name: Horizon Airlines
   - Country: Vietnam
   - Regulatory Authority: CAAV
   - Timezone: Asia/Ho_Chi_Minh
   - Enabled Modules: platform, network, operations, workforce

2. **Countries: 48 total**
   - All ASEAN countries (Vietnam, Thailand, Singapore, Malaysia, Indonesia, Philippines, Myanmar, Cambodia, Laos, Brunei)
   - Major East Asian countries (Japan, South Korea, China, Taiwan, Hong Kong, Macau)
   - South Asian countries (India, Pakistan, Bangladesh, Sri Lanka, Nepal)
   - Oceania (Australia, New Zealand)
   - Middle East (UAE, Qatar, Saudi Arabia, Turkey)
   - Europe (UK, France, Germany, Netherlands, Italy, Spain, Switzerland, Austria, Russia)
   - Americas (USA, Canada, Mexico, Brazil, Argentina, Chile)
   - Africa (South Africa, Egypt, Kenya, Nigeria, Morocco, Ethiopia)

3. **Airports: 63 total**
   - **20 Vietnam airports**: SGN, HAN, DAD, CXR, PQC, VDO, HPH, VII, HUI, BMV, VCA, UIH, TBB, DLI, VCS, VCL, THD, VKG, DIN, PXU
   - **ASEAN hubs**: BKK, DMK, HKT, CNX, USM (Thailand), SIN (Singapore), KUL, PEN, BKI (Malaysia), MNL, CEB (Philippines), CGK, DPS, SUB (Indonesia), RGN (Myanmar), PNH, REP (Cambodia), VTE, LPQ (Laos), BWN (Brunei)
   - **East Asia hubs**: HND, NRT (Japan), ICN (Korea), PEK, PVG, CAN (China), TPE (Taiwan), HKG (Hong Kong)
   - **Global hubs**: DEL, BOM (India), SYD, MEL, AKL (Oceania), DXB, DOH, IST (Middle East), LHR, CDG, FRA, AMS (Europe), JFK, LAX, SFO (USA)
   - All airports include: ICAO code, IATA code, name, city, country, country_id (FK), timezone, latitude, longitude

4. **Aircraft Types: 3 for operator HZN**
   - A320 (Airbus A320, family A320, narrow-body, 180 pax)
   - A321 (Airbus A321, family A320, narrow-body, 220 pax)
   - A333 (Airbus A330-300, family A330, wide-body, 300 pax, rest_facility_class: class_2)

5. **Airlines: 43 total**
   - **Vietnamese carriers**: Vietnam Airlines, VietJet Air, Jetstar Pacific, Bamboo Airways, Vietravel Airlines
   - **All major ASEAN carriers**: Thai Airways, AirAsia, Nok Air, Bangkok Airways, Singapore Airlines, Scoot, Malaysia Airlines, Garuda Indonesia, Lion Air, Philippine Airlines, Cebu Pacific, Myanmar National, Cambodia Angkor Air, Lao Airlines, Royal Brunei
   - **Major global carriers**: JAL, ANA, Korean Air, Asiana, Air China, China Eastern, China Southern, China Airlines, Cathay Pacific, Air India, Qantas, Air New Zealand, Emirates, Qatar Airways, Turkish Airlines, British Airways, Air France, Lufthansa, KLM, United, American, Delta

6. **City Pairs: 72 total**
   - **Domestic Vietnam routes**: SGN-HAN, SGN-DAD, SGN-CXR, SGN-PQC, SGN-HPH, SGN-VII, SGN-DLI, SGN-VCA, HAN-DAD, HAN-CXR, HAN-PQC, HAN-HUI, and reverse routes
   - **Regional from SGN**: BKK, SIN, KUL, HKG, TPE, ICN, NRT, PNH, VTE, CGK, MNL
   - **Regional from HAN**: BKK, SIN, PVG, ICN, NRT, HKG, KUL
   - **Long haul from SGN**: LHR, CDG, SYD, FRA, MEL
   - All city pairs include: departure_airport_id (FK), arrival_airport_id (FK), route_type

## Schema Notes

### Actual Database Schema (discovered)

The database schema differs significantly from the SQL migration files in the repository. Here's the actual schema:

```typescript
countries: {
  id, created_at,
  iso_code_2,      // 2-char ISO code (NOT iso_code)
  iso_code_3,      // 3-char ISO code
  name, region, icao_prefix
}

airports: {
  id, created_at,
  icao_code, iata_code, name,  // 'name' field (NOT airport_name)
  city, country,                // 'country' as string
  country_id,                   // FK to countries
  timezone, latitude, longitude
}

aircraft_types: {
  id, created_at,
  operator_id,                  // FK to operators (required!)
  icao_type, iata_type, name,
  family, category, pax_capacity,
  rest_facility_class           // nullable
}

airlines: {
  id, created_at,
  icao_code, iata_code, name,
  country_id,                   // FK to countries (NOT country string)
  alliance
}

city_pairs: {
  id, created_at,
  departure_airport_id,         // FK to airports (NOT departure_airport)
  arrival_airport_id,           // FK to airports (NOT arrival_airport)
  route_type                    // domestic/regional/international/long-haul/ultra-long-haul
  // Note: block_time, distance, etops_required fields do NOT exist
}

operators: {
  id, created_at, updated_at,
  code,                         // Operator code (e.g., 'HZN')
  iata_code,                    // IATA code (e.g., 'HZ')
  name,                         // Company name
  country, timezone,
  regulatory_authority,
  enabled_modules               // array of module names
}
```

### Tables NOT Found in Current Schema

- `operator_profile` - Does not exist as separate table. The `operators` table serves this purpose.
- `user_roles` - User role management table mentioned in requirements but not found in database
- `user_preferences` - User preferences table mentioned in requirements but not found in database
- User management appears to be handled differently (possibly through Supabase auth tables)

## Running the Seeding

To re-run or update the seeding:

```bash
npm run seed
```

The script is idempotent and uses upsert operations, so it's safe to run multiple times.

## Next Steps

1. **User Management**: If you need the `user_roles` and `user_preferences` tables, create migrations for them
2. **Link User**: The email `vivimassa@live.com` was mentioned for linking but the user system is not yet implemented in the discovered schema
3. **Additional Fields**: City pairs could benefit from `block_time`, `distance`, and `etops_required` columns if needed
4. **Crew Fields**: Aircraft types are missing `cockpit_crew` and `cabin_crew` columns from the requirements

## Files Created

- `scripts/seed-database-correct.ts` - Main seeding script
- `scripts/check-schema.ts` - Schema inspection tool
- `scripts/discover-complete-schema.ts` - Column discovery tool
