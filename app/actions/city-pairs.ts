'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CityPair, CityPairBlockHours } from '@/types/database'
import { calculateGreatCircleDistance, determineRouteType } from '@/lib/utils/geo'
import { AIRPORT_COUNTRY, classifyRoute } from '@/lib/data/airport-countries'

// ─── Extended types ──────────────────────────────────────────────────────

export interface CityPairAirport {
  id: string
  icao_code: string
  iata_code: string | null
  name: string
  city: string
  latitude: number | null
  longitude: number | null
  country_id: string | null
  countries: { name: string; iso_code_2: string; flag_emoji: string | null; region: string | null } | null
}

export interface CityPairWithAirports extends CityPair {
  airport1: CityPairAirport | null
  airport2: CityPairAirport | null
}

export interface BlockHourWithAircraftType extends CityPairBlockHours {
  aircraft_types: { icao_type: string; name: string } | null
}

// ─── Backward-compatible getCityPairs (for Schedule Builder page) ─────────

export async function getCityPairs(): Promise<CityPair[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('city_pairs')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) { console.error('Error fetching city pairs:', error); return [] }
  return data || []
}

// ─── Schedule Builder enhanced data ──────────────────────────────────────

export interface ScheduleBlockLookup {
  dep_iata: string
  arr_iata: string
  block_minutes: number
  flight_minutes: number | null
  distance_nm: number
}

export async function getCityPairsForScheduleBuilder(): Promise<{
  pairs: CityPairWithAirports[]
  blockLookup: ScheduleBlockLookup[]
}> {
  const pairs = await getCityPairsWithAirports()

  // Build block lookup from block_hours table
  const supabase = await createClient()
  const { data: blockHours } = await supabase
    .from('city_pair_block_hours')
    .select('city_pair_id, aircraft_type_id, direction1_block_minutes, direction2_block_minutes, direction1_flight_minutes, direction2_flight_minutes, aircraft_types(icao_type)')

  // Build airport ID to IATA map from pairs
  const idToIata = new Map<string, string>()
  for (const p of pairs) {
    if (p.airport1) idToIata.set(p.airport1.id, p.airport1.iata_code || p.airport1.icao_code)
    if (p.airport2) idToIata.set(p.airport2.id, p.airport2.iata_code || p.airport2.icao_code)
  }

  // Get all raw city pair data for mapping
  const { data: rawPairs } = await supabase.from('city_pairs').select('id, departure_airport_id, arrival_airport_id, great_circle_distance_nm, standard_block_minutes')
  const pairMap = new Map<string, { dep_id: string; arr_id: string; dist: number }>()
  for (const rp of rawPairs || []) {
    if (rp.departure_airport_id && rp.arrival_airport_id) {
      pairMap.set(rp.id, { dep_id: rp.departure_airport_id, arr_id: rp.arrival_airport_id, dist: rp.great_circle_distance_nm || 0 })
    }
  }

  const blockLookup: ScheduleBlockLookup[] = []
  const coveredPairIds = new Set<string>()
  for (const bh of blockHours || []) {
    const pm = pairMap.get(bh.city_pair_id)
    if (!pm) continue
    const depIata = idToIata.get(pm.dep_id)
    const arrIata = idToIata.get(pm.arr_id)
    if (!depIata || !arrIata) continue

    coveredPairIds.add(bh.city_pair_id)
    // Direction 1: dep -> arr
    blockLookup.push({ dep_iata: depIata, arr_iata: arrIata, block_minutes: bh.direction1_block_minutes, flight_minutes: bh.direction1_flight_minutes ?? null, distance_nm: pm.dist })
    // Direction 2: arr -> dep
    blockLookup.push({ dep_iata: arrIata, arr_iata: depIata, block_minutes: bh.direction2_block_minutes, flight_minutes: bh.direction2_flight_minutes ?? null, distance_nm: pm.dist })
  }

  // Fallback: for city pairs with no block_hours entry, use standard_block_minutes
  for (const rp of rawPairs || []) {
    if (coveredPairIds.has(rp.id)) continue
    const sbm = rp.standard_block_minutes as number | null
    if (!sbm || sbm <= 0) continue
    const depIata = idToIata.get(rp.departure_airport_id)
    const arrIata = idToIata.get(rp.arrival_airport_id)
    if (!depIata || !arrIata) continue
    const dist = rp.great_circle_distance_nm || 0
    // Use same block time for both directions as a fallback
    blockLookup.push({ dep_iata: depIata, arr_iata: arrIata, block_minutes: sbm, flight_minutes: null, distance_nm: dist })
    blockLookup.push({ dep_iata: arrIata, arr_iata: depIata, block_minutes: sbm, flight_minutes: null, distance_nm: dist })
  }

  return { pairs, blockLookup }
}

// ─── Fetch city pairs ────────────────────────────────────────────────────

export async function getCityPairsWithAirports(): Promise<CityPairWithAirports[]> {
  const supabase = await createClient()

  const { data: pairs, error } = await supabase
    .from('city_pairs')
    .select('*')
    .order('created_at', { ascending: true })

  if (error || !pairs) {
    console.error('Error fetching city pairs:', error)
    return []
  }

  // Collect unique airport IDs
  const airportIds = new Set<string>()
  for (const p of pairs) {
    if (p.departure_airport_id) airportIds.add(p.departure_airport_id)
    if (p.arrival_airport_id) airportIds.add(p.arrival_airport_id)
  }

  // Fetch airports with countries
  const { data: airports } = await supabase
    .from('airports')
    .select('id, icao_code, iata_code, name, city, latitude, longitude, country_id, countries(name, iso_code_2, flag_emoji, region)')
    .in('id', Array.from(airportIds))

  const airportMap = new Map<string, CityPairAirport>()
  if (airports) {
    for (const a of airports) {
      airportMap.set(a.id, a as unknown as CityPairAirport)
    }
  }

  // Deduplicate: keep only one direction per pair (alphabetically by IATA)
  const seen = new Map<string, CityPairWithAirports>()
  const result: CityPairWithAirports[] = []

  for (const p of pairs) {
    const dep = p.departure_airport_id ? airportMap.get(p.departure_airport_id) || null : null
    const arr = p.arrival_airport_id ? airportMap.get(p.arrival_airport_id) || null : null

    const ids = [p.departure_airport_id, p.arrival_airport_id].filter(Boolean).sort()
    const key = ids.join('|')

    if (seen.has(key)) continue

    // Ensure station1 is alphabetically first by IATA
    let airport1 = dep
    let airport2 = arr
    if (airport1 && airport2 && (airport1.iata_code || '') > (airport2.iata_code || '')) {
      airport1 = arr
      airport2 = dep
    }

    const entry: CityPairWithAirports = { ...p, airport1, airport2 }
    seen.set(key, entry)
    result.push(entry)
  }

  return result
}

// ─── Fetch block hours for a city pair ───────────────────────────────────

export async function getBlockHoursForPair(cityPairId: string): Promise<BlockHourWithAircraftType[]> {
  const supabase = await createClient()

  // Get pair airports to find both direction rows
  const { data: pair } = await supabase
    .from('city_pairs')
    .select('departure_airport_id, arrival_airport_id')
    .eq('id', cityPairId)
    .single()

  if (!pair) return []

  // Find both direction pairs
  const { data: allPairs } = await supabase
    .from('city_pairs')
    .select('id')
    .or(`and(departure_airport_id.eq.${pair.departure_airport_id},arrival_airport_id.eq.${pair.arrival_airport_id}),and(departure_airport_id.eq.${pair.arrival_airport_id},arrival_airport_id.eq.${pair.departure_airport_id})`)

  const pairIds = allPairs?.map(p => p.id) || [cityPairId]

  const { data, error } = await supabase
    .from('city_pair_block_hours')
    .select('*, aircraft_types(icao_type, name)')
    .in('city_pair_id', pairIds)
    .order('season_type')
    .order('month_applicable')

  if (error) {
    console.error('Error fetching block hours:', error)
    return []
  }
  return (data as unknown as BlockHourWithAircraftType[]) || []
}

// ─── Update city pair field ──────────────────────────────────────────────

const ALLOWED_FIELDS = [
  'great_circle_distance_nm', 'route_type', 'is_etops', 'etops_diversion_time_minutes',
  'status', 'notes', 'is_active', 'is_overwater', 'requires_special_qualification',
  'standard_block_minutes', 'distance_nm',
] as const

export async function updateCityPairField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!ALLOWED_FIELDS.includes(field as typeof ALLOWED_FIELDS[number])) {
    return { error: 'Invalid field' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from('city_pairs').update({ [field]: value }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/city-pairs')
  return { success: true }
}

// ─── Create city pair ────────────────────────────────────────────────────

export async function createCityPair(
  airport1Id: string,
  airport2Id: string
): Promise<{ success?: boolean; error?: string; id?: string }> {
  const supabase = createAdminClient()

  if (airport1Id === airport2Id) {
    return { error: 'Station 1 and Station 2 cannot be the same airport' }
  }

  const { data: airports } = await supabase
    .from('airports')
    .select('id, icao_code, iata_code, name, latitude, longitude, country_id, countries(region)')
    .in('id', [airport1Id, airport2Id])

  if (!airports || airports.length !== 2) {
    return { error: 'One or both airports not found' }
  }

  const apt1 = airports.find(a => a.id === airport1Id)!
  const apt2 = airports.find(a => a.id === airport2Id)!

  // Check if pair already exists (either direction)
  const { data: existing } = await supabase
    .from('city_pairs')
    .select('id')
    .or(`and(departure_airport_id.eq.${airport1Id},arrival_airport_id.eq.${airport2Id}),and(departure_airport_id.eq.${airport2Id},arrival_airport_id.eq.${airport1Id})`)
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: `City pair ${apt1.iata_code || apt1.icao_code} ↔ ${apt2.iata_code || apt2.icao_code} already exists` }
  }

  let distanceNm: number | null = null
  if (apt1.latitude && apt1.longitude && apt2.latitude && apt2.longitude) {
    distanceNm = calculateGreatCircleDistance(apt1.latitude, apt1.longitude, apt2.latitude, apt2.longitude)
  }

  const region1 = (apt1.countries as any)?.region || null
  const region2 = (apt2.countries as any)?.region || null
  const routeType = determineRouteType(apt1.country_id, apt2.country_id, region1, region2, apt1.iata_code, apt2.iata_code)

  // Always set both UUID and string columns so JOINs never break
  const depCode = apt1.iata_code || apt1.icao_code
  const arrCode = apt2.iata_code || apt2.icao_code

  const { data: newPair, error } = await supabase
    .from('city_pairs')
    .insert({
      departure_airport_id: airport1Id,
      arrival_airport_id: airport2Id,
      departure_airport: depCode,
      arrival_airport: arrCode,
      great_circle_distance_nm: distanceNm,
      route_type: routeType,
      status: 'active',
      is_etops: false,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/master-database/city-pairs')
  return { success: true, id: newPair.id }
}

// ─── Create city pair from IATA codes (Schedule Builder) ─────────────────

export async function createCityPairFromIata(
  depIata: string,
  arrIata: string
): Promise<{ success?: boolean; error?: string; distance_nm?: number; route_type?: string }> {
  const supabase = createAdminClient()

  // Lookup airports by IATA
  const { data: airports } = await supabase
    .from('airports')
    .select('id, iata_code, latitude, longitude, country_id, countries(region)')
    .in('iata_code', [depIata.toUpperCase(), arrIata.toUpperCase()])

  if (!airports || airports.length < 2) {
    const found = airports?.map(a => a.iata_code) || []
    const missing = [depIata, arrIata].filter(c => !found.includes(c.toUpperCase()))
    return { error: `Airport${missing.length > 1 ? 's' : ''} '${missing.join("', '")}' not found` }
  }

  const apt1 = airports.find(a => a.iata_code === depIata.toUpperCase())!
  const apt2 = airports.find(a => a.iata_code === arrIata.toUpperCase())!

  const result = await createCityPair(apt1.id, apt2.id)
  if (result.error) return result

  // Return calculated info
  let distanceNm: number | undefined
  if (apt1.latitude && apt1.longitude && apt2.latitude && apt2.longitude) {
    distanceNm = calculateGreatCircleDistance(apt1.latitude, apt1.longitude, apt2.latitude, apt2.longitude)
  }

  const region1 = (apt1.countries as any)?.region || null
  const region2 = (apt2.countries as any)?.region || null
  const routeType = determineRouteType(apt1.country_id, apt2.country_id, region1, region2, apt1.iata_code, apt2.iata_code)

  return { success: true, distance_nm: distanceNm, route_type: routeType }
}

// ─── Delete city pair ────────────────────────────────────────────────────

export async function deleteCityPair(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('city_pairs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/city-pairs')
  return { success: true }
}

// ─── Block hours CRUD ────────────────────────────────────────────────────

export async function addBlockHour(data: {
  city_pair_id: string
  aircraft_type_id: string
  season_type: string
  month_applicable: number | null
  direction1_block_minutes: number
  direction2_block_minutes: number
  direction1_flight_minutes?: number | null
  direction2_flight_minutes?: number | null
  direction1_fuel_kg?: number | null
  direction2_fuel_kg?: number | null
  notes?: string | null
}) {
  const supabase = createAdminClient()
  const { data: row, error } = await supabase
    .from('city_pair_block_hours')
    .insert(data)
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/city-pairs')
  return { success: true, id: row.id }
}

export async function updateBlockHour(
  id: string,
  fields: Record<string, string | number | boolean | null>
) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('city_pair_block_hours').update(fields).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/city-pairs')
  return { success: true }
}

export async function deleteBlockHour(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('city_pair_block_hours').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/city-pairs')
  return { success: true }
}

// ─── Auto-estimate flight hours from block hours ─────────────────────────

export async function autoEstimateFlightHours(cityPairId: string, taxiMinutes: number = 15) {
  const supabase = createAdminClient()
  const blockHours = await getBlockHoursForPair(cityPairId)

  if (!blockHours.length) return { error: 'No block hours found' }

  const adminClient = createAdminClient()
  let updated = 0
  for (const h of blockHours) {
    if (h.direction1_flight_minutes == null || h.direction2_flight_minutes == null) {
      await adminClient.from('city_pair_block_hours').update({
        direction1_flight_minutes: Math.max(0, h.direction1_block_minutes - taxiMinutes),
        direction2_flight_minutes: Math.max(0, h.direction2_block_minutes - taxiMinutes),
      }).eq('id', h.id)
      updated++
    }
  }

  revalidatePath('/admin/master-database/city-pairs')
  return { success: true, updated }
}

// ─── Airport search for add dialog ───────────────────────────────────────

export async function searchAirports(query: string): Promise<CityPairAirport[]> {
  const supabase = await createClient()
  const q = query.toUpperCase().trim()
  if (!q) return []

  const { data } = await supabase
    .from('airports')
    .select('id, icao_code, iata_code, name, city, latitude, longitude, country_id, countries(name, iso_code_2, flag_emoji, region)')
    .or(`iata_code.ilike.%${q}%,icao_code.ilike.%${q}%,name.ilike.%${q}%,city.ilike.%${q}%`)
    .order('iata_code')
    .limit(20)

  return (data as unknown as CityPairAirport[]) || []
}

// ─── Fix misclassified city pairs ─────────────────────────────────────────

export async function fixCityPairClassification(): Promise<{
  fixed: number
  unknown: number
  details: string[]
}> {
  const supabase = createAdminClient()

  // Fetch all city pairs with their airports' IATA codes
  const { data: pairs } = await supabase
    .from('city_pairs')
    .select('id, departure_airport, arrival_airport, route_type, departure_airport_id, arrival_airport_id')

  if (!pairs) return { fixed: 0, unknown: 0, details: [] }

  // Also fetch airports with country_id to use as additional context
  const { data: airports } = await supabase
    .from('airports')
    .select('iata_code, country_id, countries(iso_code_2)')

  const dbCountryMap = new Map<string, string>()
  airports?.forEach(a => {
    const iso = (a.countries as any)?.iso_code_2
    if (a.iata_code && iso) dbCountryMap.set(a.iata_code, iso)
  })

  let fixed = 0
  let unknown = 0
  const details: string[] = []

  for (const pair of pairs) {
    const dep = pair.departure_airport
    const arr = pair.arrival_airport
    if (!dep || !arr) continue

    const result = classifyRoute(dep, arr, dbCountryMap)
    const currentType = pair.route_type

    if (result === 'unknown') {
      if (currentType !== 'unknown') {
        // Only mark as unknown if we're sure the classification is wrong
        unknown++
        details.push(`${dep}-${arr}: cannot classify (missing country data)`)
      }
      continue
    }

    // Fix misclassified pairs
    if (result === 'domestic' && currentType !== 'domestic') {
      await supabase.from('city_pairs').update({ route_type: 'domestic' }).eq('id', pair.id)
      fixed++
      details.push(`${dep}-${arr}: ${currentType} → domestic`)
    } else if (result === 'international' && currentType === 'domestic') {
      await supabase.from('city_pairs').update({ route_type: 'international' }).eq('id', pair.id)
      fixed++
      details.push(`${dep}-${arr}: domestic → international`)
    }
  }

  if (fixed > 0) {
    revalidatePath('/admin/master-database/city-pairs')
  }

  return { fixed, unknown, details }
}

// ─── Comprehensive data repair ──────────────────────────────────────────
// Fixes ALL known data integrity issues in city_pairs + scheduled_flights.
// Safe to call repeatedly — idempotent. Should be called after SSIM import
// and can be triggered from admin UI if data looks wrong.

export interface RepairResult {
  stringsBackfilled: number
  routeTypesFixed: number
  cityPairIdsLinked: number
  details: string[]
}

export async function repairCityPairData(): Promise<RepairResult> {
  const supabase = createAdminClient()
  const details: string[] = []

  // ── Step 1: Backfill missing departure_airport / arrival_airport strings ──
  // Any city_pair with UUID IDs but NULL string codes gets its strings filled
  // from the linked airports' IATA codes.
  const { data: pairsWithNulls } = await supabase
    .from('city_pairs')
    .select('id, departure_airport, arrival_airport, departure_airport_id, arrival_airport_id')
    .or('departure_airport.is.null,arrival_airport.is.null')

  let stringsBackfilled = 0
  if (pairsWithNulls && pairsWithNulls.length > 0) {
    // Collect all airport IDs we need to look up
    const airportIds = new Set<string>()
    for (const p of pairsWithNulls) {
      if (p.departure_airport_id) airportIds.add(p.departure_airport_id)
      if (p.arrival_airport_id) airportIds.add(p.arrival_airport_id)
    }

    const { data: airports } = await supabase
      .from('airports')
      .select('id, iata_code, icao_code')
      .in('id', Array.from(airportIds))

    const idToCode = new Map<string, string>()
    airports?.forEach(a => {
      idToCode.set(a.id, a.iata_code || a.icao_code)
    })

    for (const p of pairsWithNulls) {
      const updates: Record<string, string> = {}
      if (!p.departure_airport && p.departure_airport_id) {
        const code = idToCode.get(p.departure_airport_id)
        if (code) updates.departure_airport = code
      }
      if (!p.arrival_airport && p.arrival_airport_id) {
        const code = idToCode.get(p.arrival_airport_id)
        if (code) updates.arrival_airport = code
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('city_pairs').update(updates).eq('id', p.id)
        stringsBackfilled++
        details.push(`Backfilled strings: ${updates.departure_airport || p.departure_airport}-${updates.arrival_airport || p.arrival_airport}`)
      }
    }
  }

  // ── Step 2: Recompute route_type from DB country data ─────────────────
  // Uses airport → country UUID comparison as primary, IATA hardcoded as fallback.
  // Fixes NULL, 'unknown', and any misclassified pairs.
  const { data: allPairs } = await supabase
    .from('city_pairs')
    .select('id, departure_airport, arrival_airport, departure_airport_id, arrival_airport_id, route_type')

  const { data: allAirports } = await supabase
    .from('airports')
    .select('id, iata_code, icao_code, country_id, countries(iso_code_2, region)')

  // Build lookup maps
  const airportById = new Map<string, { iata: string | null; countryId: string | null; iso: string | null; region: string | null }>()
  const dbCountryMap = new Map<string, string>()
  allAirports?.forEach(a => {
    const iso = (a.countries as any)?.iso_code_2 || null
    const region = (a.countries as any)?.region || null
    airportById.set(a.id, { iata: a.iata_code, countryId: a.country_id, iso, region })
    if (a.iata_code && iso) dbCountryMap.set(a.iata_code, iso)
  })

  let routeTypesFixed = 0
  if (allPairs) {
    for (const p of allPairs) {
      const depApt = p.departure_airport_id ? airportById.get(p.departure_airport_id) : null
      const arrApt = p.arrival_airport_id ? airportById.get(p.arrival_airport_id) : null

      // Try UUID-based country comparison first
      let computed: string | null = null
      if (depApt?.countryId && arrApt?.countryId) {
        if (depApt.countryId === arrApt.countryId) {
          computed = 'domestic'
        } else if (depApt.region && arrApt.region && depApt.region === arrApt.region) {
          computed = 'regional'
        } else {
          computed = 'international'
        }
      }

      // Fallback: IATA hardcoded + DB map
      if (!computed) {
        const depCode = p.departure_airport || depApt?.iata || null
        const arrCode = p.arrival_airport || arrApt?.iata || null
        if (depCode && arrCode) {
          const result = classifyRoute(depCode, arrCode, dbCountryMap)
          if (result !== 'unknown') computed = result
        }
      }

      if (computed && computed !== p.route_type) {
        await supabase.from('city_pairs').update({ route_type: computed }).eq('id', p.id)
        routeTypesFixed++
        details.push(`Route type: ${p.departure_airport || '?'}-${p.arrival_airport || '?'}: ${p.route_type || 'NULL'} → ${computed}`)
      }
    }
  }

  // ── Step 3: Backfill missing dep_airport_id / arr_airport_id on flights ──
  // Ensures all flights have proper FK references to airports.
  const { Pool } = await import('pg')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  const ra1 = await pool.query(`
    UPDATE scheduled_flights sf SET dep_airport_id = a.id
    FROM airports a
    WHERE sf.dep_station = a.iata_code AND sf.dep_airport_id IS NULL
  `)
  const ra2 = await pool.query(`
    UPDATE scheduled_flights sf SET arr_airport_id = a.id
    FROM airports a
    WHERE sf.arr_station = a.iata_code AND sf.arr_airport_id IS NULL
  `)
  const airportIdsFixed = (ra1.rowCount || 0) + (ra2.rowCount || 0)
  if (airportIdsFixed > 0) {
    details.push(`Backfilled ${airportIdsFixed} airport ID references on flights`)
  }

  // ── Step 4: Backfill missing city_pair_id on scheduled_flights ────────
  // Tries string match first, then airport ID match.
  // This ensures builder-created flights also get linked.

  // 3a: String match (handles SSIM-imported flights)
  const r1 = await pool.query(`
    UPDATE scheduled_flights sf SET city_pair_id = cp.id
    FROM city_pairs cp
    WHERE sf.dep_station = cp.departure_airport
      AND sf.arr_station = cp.arrival_airport
      AND sf.city_pair_id IS NULL
  `)
  let cityPairIdsLinked = r1.rowCount || 0

  // 3b: Airport ID match (handles builder-created flights + admin-created pairs)
  const r2 = await pool.query(`
    UPDATE scheduled_flights sf SET city_pair_id = cp.id
    FROM city_pairs cp
    WHERE sf.dep_airport_id = cp.departure_airport_id
      AND sf.arr_airport_id = cp.arrival_airport_id
      AND sf.city_pair_id IS NULL
      AND sf.dep_airport_id IS NOT NULL
      AND sf.arr_airport_id IS NOT NULL
  `)
  cityPairIdsLinked += r2.rowCount || 0

  if (cityPairIdsLinked > 0) {
    details.push(`Linked ${cityPairIdsLinked} flights to city pairs`)
  }

  await pool.end()

  if (routeTypesFixed > 0 || stringsBackfilled > 0) {
    revalidatePath('/admin/master-database/city-pairs')
  }

  return { stringsBackfilled, routeTypesFixed, cityPairIdsLinked, details }
}
