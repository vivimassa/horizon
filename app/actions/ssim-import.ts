'use server'

import { Pool } from 'pg'
import { getCurrentOperatorId } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { parseSSIM, toUtcTime } from '@/lib/utils/ssim-parser'
import type { SSIMFlightLeg, SSIMParseResult } from '@/lib/utils/ssim-parser'
import { AIRPORT_COUNTRY, classifyRoute } from '@/lib/data/airport-countries'
import { lookupAirportByIATA } from '@/app/actions/airport-inquiry'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Types ─────────────────────────────────────────────────────────

export interface ValidationResult {
  airlineMatch: boolean
  recordCountMatch: boolean
  missingAirports: string[]
  missingCityPairs: string[]
  missingAircraftTypes: string[]
  seasonMatch: { id: string; code: string; name: string } | null
  allAircraftFound: boolean
}

/** Lightweight flight data for sending back to client after server-side parsing */
export interface ParsedFlightData {
  airlineCode: string
  flightNumber: number
  itineraryVariation: string
  legSequence: string
  serviceType: string
  periodStart: string
  periodEnd: string
  daysOfOperation: string
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  depUtcOffset: string
  arrUtcOffset: string
  aircraftType: string
  seatConfig: Record<string, number>
  blockMinutes: number
  recordNumber: number
}

export interface ParseSSIMResult {
  flights: ParsedFlightData[]
  carrier: SSIMParseResult['carrier']
  stats: SSIMParseResult['stats']
  errors: SSIMParseResult['errors']
  trailer: SSIMParseResult['trailer']
  validation: ValidationResult
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Determine route type using hardcoded lookup + DB country map as fallback */
function getRouteType(dep: string, arr: string, dbCountryMap: Map<string, string>): string {
  const result = classifyRoute(dep, arr, dbCountryMap)
  if (result === 'unknown') return 'international' // safe default for SSIM import
  return result
}

// ─── ACTION 1: Parse SSIM File ────────────────────────────────────
// Client sends raw file text → server parses → returns parsed data + validation

export async function parseSSIMFile(fileContent: string): Promise<ParseSSIMResult> {
  console.log('SSIM Import: parseSSIMFile called, content length:', fileContent.length)
  const operatorId = await getCurrentOperatorId()
  const supabase = createAdminClient()

  // Parse the file
  const result = parseSSIM(fileContent)
  console.log('SSIM Import: Parsed', result.flights.length, 'flights')

  // Convert to lightweight format (strip rawLine)
  const flights: ParsedFlightData[] = result.flights.map(f => ({
    airlineCode: f.airlineCode,
    flightNumber: f.flightNumber,
    itineraryVariation: f.itineraryVariation,
    legSequence: f.legSequence,
    serviceType: f.serviceType,
    periodStart: f.periodStart,
    periodEnd: f.periodEnd,
    daysOfOperation: f.daysOfOperation,
    depStation: f.depStation,
    arrStation: f.arrStation,
    stdUtc: f.stdUtc,
    staUtc: f.staUtc,
    depUtcOffset: f.depUtcOffset,
    arrUtcOffset: f.arrUtcOffset,
    aircraftType: f.aircraftType,
    seatConfig: f.seatConfig,
    blockMinutes: f.blockMinutes,
    recordNumber: f.recordNumber,
  }))

  // Run validation
  const { data: operator } = await supabase
    .from('operators')
    .select('iata_code')
    .eq('id', operatorId)
    .single()

  const airlineMatch = operator?.iata_code === result.carrier?.airlineCode

  const recordCountMatch = result.trailer
    ? result.flights.length === (result.trailer.lastFlightSerial - 2)
    : true

  const { data: airports } = await supabase.from('airports').select('iata_code')
  const existingAirports = new Set(airports?.map(a => a.iata_code).filter(Boolean))

  const allStations = new Set<string>()
  result.flights.forEach(f => { allStations.add(f.depStation); allStations.add(f.arrStation) })
  const missingAirports = Array.from(allStations).filter(s => !existingAirports.has(s))

  const { data: cityPairs } = await supabase
    .from('city_pairs')
    .select('departure_airport, arrival_airport')
  const existingPairs = new Set(cityPairs?.map(cp => `${cp.departure_airport}-${cp.arrival_airport}`))

  const allRoutes = new Set<string>()
  result.flights.forEach(f => allRoutes.add(`${f.depStation}-${f.arrStation}`))
  const missingCityPairs = Array.from(allRoutes).filter(r => !existingPairs.has(r))

  const { data: acTypes } = await supabase.from('aircraft_types').select('iata_type, icao_type')
  const existingIata = new Set(acTypes?.map(a => a.iata_type).filter(Boolean))
  const existingIcao = new Set(acTypes?.map(a => a.icao_type).filter(Boolean))

  const allAcTypes = new Set<string>()
  result.flights.forEach(f => { if (f.aircraftType) allAcTypes.add(f.aircraftType) })
  const missingAircraftTypes = Array.from(allAcTypes).filter(t =>
    !existingIata.has(t) && !existingIcao.has(t)
  )

  const { data: seasons } = await supabase
    .from('schedule_seasons')
    .select('id, code, name, start_date, end_date')
    .eq('operator_id', operatorId)
    .order('start_date', { ascending: false })

  let seasonMatch = null
  if (result.carrier) {
    const fileStart = result.carrier.seasonStart
    const fileEnd = result.carrier.seasonEnd
    seasonMatch = seasons?.find(s => s.start_date <= fileEnd && s.end_date >= fileStart) || null
  }

  console.log('SSIM Import: Parse complete. Missing airports:', missingAirports.length,
    'Missing city pairs:', missingCityPairs.length,
    'Missing aircraft:', missingAircraftTypes.length,
    'Season match:', seasonMatch?.code || 'none')

  return {
    flights,
    carrier: result.carrier,
    stats: result.stats,
    errors: result.errors,
    trailer: result.trailer,
    validation: {
      airlineMatch,
      recordCountMatch,
      missingAirports,
      missingCityPairs,
      missingAircraftTypes,
      seasonMatch: seasonMatch ? { id: seasonMatch.id, code: seasonMatch.code, name: seasonMatch.name } : null,
      allAircraftFound: missingAircraftTypes.length === 0,
    },
  }
}

// ─── ACTION 2: Create Missing Airports ────────────────────────────

export async function createMissingAirports(
  airportCodes: string[]
): Promise<{ created: number; airportMap: Record<string, string> }> {
  console.log('SSIM Import: Creating', airportCodes.length, 'missing airports')
  const supabase = createAdminClient()
  const airportMap: Record<string, string> = {}
  let created = 0

  // Build ISO code → country UUID map from countries table
  const { data: countries } = await supabase.from('countries').select('id, iso_code_2')
  const isoToCountryId = new Map<string, string>()
  countries?.forEach(c => isoToCountryId.set(c.iso_code_2, c.id))

  for (const iata of airportCodes) {
    // Look up real airport data from OurAirports
    const info = await lookupAirportByIATA(iata)

    const realIcao = info?.icao_code || `Z${iata}`
    const name = info?.name || iata
    const city = info?.city || null
    const isoCode = info?.iso_country || AIRPORT_COUNTRY[iata] || null
    const countryId = isoCode ? isoToCountryId.get(isoCode) ?? null : null
    const lat = info?.latitude ?? null
    const lon = info?.longitude ?? null
    const elev = info?.elevation_ft ?? null

    // Resolve timezone from country's timezone zones
    let timezone = 'UTC'
    if (countryId) {
      const { data: zones } = await supabase
        .from('timezone_zones')
        .select('iana_timezone')
        .eq('country_id', countryId)
        .limit(1)
      if (zones?.[0]) timezone = zones[0].iana_timezone
    }

    const { data } = await supabase
      .from('airports')
      .insert({
        iata_code: iata,
        icao_code: realIcao,
        name,
        city,
        timezone,
        country: isoCode,
        country_id: countryId,
        latitude: lat,
        longitude: lon,
        elevation_ft: elev,
        is_active: true,
      })
      .select('id')
      .single()
    if (data) {
      airportMap[iata] = data.id
      created++
    }
  }

  console.log('SSIM Import: Created', created, 'airports')
  return { created, airportMap }
}

// ─── ACTION 3: Create Missing City Pairs ──────────────────────────

export async function createMissingCityPairs(
  pairs: { dep: string; arr: string }[]
): Promise<{ created: number; domesticFixed: number }> {
  console.log('SSIM Import: Creating', pairs.length, 'missing city pairs')
  const supabase = createAdminClient()

  // Build airport ID + country map for references and route type detection
  const { data: airportRows } = await supabase
    .from('airports')
    .select('id, iata_code, country_id, countries(iso_code_2)')
  const airportIdMap = new Map<string, string>()
  const dbCountryMap = new Map<string, string>()
  airportRows?.forEach(a => {
    if (a.iata_code) {
      airportIdMap.set(a.iata_code, a.id)
      const iso = (a.countries as any)?.iso_code_2
      if (iso) dbCountryMap.set(a.iata_code, iso)
    }
  })

  let created = 0
  for (const { dep, arr } of pairs) {
    const depId = airportIdMap.get(dep)
    const arrId = airportIdMap.get(arr)
    if (depId && arrId) {
      const routeType = getRouteType(dep, arr, dbCountryMap)
      const { error } = await supabase.from('city_pairs').insert({
        departure_airport: dep,
        arrival_airport: arr,
        departure_airport_id: depId,
        arrival_airport_id: arrId,
        route_type: routeType,
        status: 'active',
        is_active: true,
      })
      if (!error) {
        created++
      } else {
        console.log('SSIM Import: Failed to create city pair', dep, '->', arr, ':', error.message)
      }
    }
  }

  // Fix existing misclassified domestic city pairs using hardcoded lookup
  // Any pair where both airports are in the same country should be domestic
  const vnIatas = Object.entries(AIRPORT_COUNTRY)
    .filter(([, cc]) => cc === 'VN')
    .map(([iata]) => iata)
  const fixResult = await pool.query(
    `UPDATE city_pairs SET route_type = 'domestic'
     WHERE departure_airport = ANY($1) AND arrival_airport = ANY($1)
     AND route_type != 'domestic'`,
    [vnIatas]
  )
  const domesticFixed = fixResult.rowCount || 0
  if (domesticFixed > 0) {
    console.log('SSIM Import: Fixed', domesticFixed, 'existing city pairs from international -> domestic')
  }

  console.log('SSIM Import: Created', created, 'city pairs,', domesticFixed, 'existing pairs corrected')
  return { created, domesticFixed }
}

// ─── ACTION 4: Import Flight Batch ────────────────────────────────
// Accepts MAX 50 flights per call. Client calls this in a loop.

export async function importFlightBatch(
  flights: ParsedFlightData[],
  seasonId: string,
  batchNum?: number
): Promise<{ created: number; errors: { line: number; message: string }[] }> {
  const operatorId = await getCurrentOperatorId()
  const label = batchNum ? `Batch ${batchNum}` : 'Batch'
  console.log(`SSIM Import: ${label}: inserting ${flights.length} flights, operator=${operatorId}, season=${seasonId}`)

  const supabase = createAdminClient()

  // Build aircraft type lookup
  const { data: acTypes } = await supabase.from('aircraft_types').select('id, iata_type, icao_type')
  const acByIata = new Map<string, string>()
  const acByIcao = new Map<string, string>()
  acTypes?.forEach(t => {
    if (t.iata_type) acByIata.set(t.iata_type, t.id)
    if (t.icao_type) acByIcao.set(t.icao_type, t.id)
  })

  const resolveAircraftTypeId = (code: string) => {
    // Direct match against icao_type
    const icaoId = acByIcao.get(code)
    if (icaoId) return { id: icaoId, icao: code }
    // Fallback to iata_type
    const iataId = acByIata.get(code)
    if (iataId) return { id: iataId, icao: code }
    return { id: null, icao: code }
  }

  // Build INSERT values
  const values: unknown[] = []
  const placeholders: string[] = []

  for (let j = 0; j < flights.length; j++) {
    const f = flights[j]
    const offset = j * 24
    const acResolved = resolveAircraftTypeId(f.aircraftType)
    const stdUtc = toUtcTime(f.stdUtc, f.depUtcOffset)
    const staUtc = toUtcTime(f.staUtc, f.arrUtcOffset)
    const stdTime = f.stdUtc.slice(0, 2) + ':' + f.stdUtc.slice(2, 4)
    const staTime = f.staUtc.slice(0, 2) + ':' + f.staUtc.slice(2, 4)
    const stdUtcTime = stdUtc ? stdUtc.slice(0, 2) + ':' + stdUtc.slice(2, 4) : null
    const staUtcTime = staUtc ? staUtc.slice(0, 2) + ':' + staUtc.slice(2, 4) : null

    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13},$${offset + 14},$${offset + 15},$${offset + 16},$${offset + 17},$${offset + 18},$${offset + 19},$${offset + 20},$${offset + 21},$${offset + 22},$${offset + 23},$${offset + 24})`
    )
    values.push(
      operatorId, seasonId, f.airlineCode, f.flightNumber,
      f.itineraryVariation, f.legSequence, f.serviceType,
      f.periodStart, f.periodEnd, f.daysOfOperation,
      f.depStation, f.arrStation, stdTime, staTime,
      f.depUtcOffset, f.arrUtcOffset, stdUtcTime, staUtcTime,
      f.blockMinutes, acResolved.icao, acResolved.id,
      JSON.stringify(f.seatConfig), 'ssim', 'draft',
    )
  }

  // Log first flight in batch for debugging
  if (flights.length > 0) {
    const f = flights[0]
    console.log(`SSIM Import: ${label}: first flight: ${f.airlineCode}${f.flightNumber} ${f.depStation}-${f.arrStation} ${f.periodStart}`)
  }

  let created = 0
  const errors: { line: number; message: string }[] = []

  if (placeholders.length > 0) {
    try {
      const result = await pool.query(
        `INSERT INTO scheduled_flights (
          operator_id, season_id, airline_code, flight_number,
          itinerary_variation, leg_sequence, service_type,
          period_start, period_end, days_of_operation,
          dep_station, arr_station, std_local, sta_local,
          dep_utc_offset, arr_utc_offset, std_utc, sta_utc,
          block_minutes, aircraft_type_icao, aircraft_type_id,
          seat_config, source, status
        ) VALUES ${placeholders.join(',')}`,
        values
      )
      created = result.rowCount || flights.length
      console.log(`SSIM Import: ${label}: SUCCESS, inserted ${created} rows`)
    } catch (batchErr) {
      console.error(`SSIM Import: ${label}: BATCH FAILED:`, batchErr instanceof Error ? batchErr.message : String(batchErr))
      // Fallback: one-by-one to identify bad records
      for (let j = 0; j < flights.length; j++) {
        const singleValues = values.slice(j * 24, (j + 1) * 24)
        const singlePh = Array.from({ length: 24 }, (_, k) => `$${k + 1}`).join(',')
        try {
          await pool.query(
            `INSERT INTO scheduled_flights (
              operator_id, season_id, airline_code, flight_number,
              itinerary_variation, leg_sequence, service_type,
              period_start, period_end, days_of_operation,
              dep_station, arr_station, std_local, sta_local,
              dep_utc_offset, arr_utc_offset, std_utc, sta_utc,
              block_minutes, aircraft_type_icao, aircraft_type_id,
              seat_config, source, status
            ) VALUES (${singlePh})`,
            singleValues
          )
          created++
        } catch (innerErr) {
          const msg = `${flights[j].airlineCode}${flights[j].flightNumber}: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`
          console.error(`SSIM Import: ${label}: Row ${j} FAILED:`, msg)
          errors.push({ line: flights[j].recordNumber, message: msg })
        }
      }
      console.log(`SSIM Import: ${label}: one-by-one fallback done: ${created} ok, ${errors.length} errors`)
    }
  }

  return { created, errors }
}

// ─── ACTION 5: Clear Season Flights (Replace Mode) ────────────────

export async function clearSeasonFlights(
  seasonId: string,
  dateRange?: { from: string; to: string }
): Promise<{ deleted: number }> {
  const operatorId = await getCurrentOperatorId()
  console.log('SSIM Import: Clearing flights for season', seasonId, 'operator', operatorId, dateRange ? `(${dateRange.from} to ${dateRange.to})` : '(all)')

  // 1. Collect flight IDs to delete
  const whereClause = dateRange
    ? 'operator_id = $1 AND season_id = $2 AND period_start <= $3 AND period_end >= $4'
    : 'operator_id = $1 AND season_id = $2'
  const params = dateRange
    ? [operatorId, seasonId, dateRange.to, dateRange.from]
    : [operatorId, seasonId]

  const idsResult = await pool.query(
    `SELECT id FROM scheduled_flights WHERE ${whereClause}`,
    params
  )
  const flightIds: string[] = idsResult.rows.map((r: { id: string }) => r.id)

  if (flightIds.length === 0) {
    console.log('SSIM Import: No flights to clear')
    return { deleted: 0 }
  }

  console.log('SSIM Import: Found', flightIds.length, 'flights to clear, deleting child records first...')

  // 2. Clear self-referential replaces_flight_id pointers
  const r0 = await pool.query(
    `UPDATE scheduled_flights SET replaces_flight_id = NULL WHERE replaces_flight_id = ANY($1::uuid[])`,
    [flightIds]
  )
  if ((r0.rowCount || 0) > 0) console.log('SSIM Import: Cleared', r0.rowCount, 'replaces_flight_id references')

  // 3. Delete child: flight_tail_assignments
  const r1 = await pool.query(
    `DELETE FROM flight_tail_assignments WHERE scheduled_flight_id = ANY($1::uuid[])`,
    [flightIds]
  )
  if ((r1.rowCount || 0) > 0) console.log('SSIM Import: Deleted', r1.rowCount, 'flight_tail_assignments')

  // 4. Delete child: aircraft_route_legs
  const r2 = await pool.query(
    `DELETE FROM aircraft_route_legs WHERE flight_id = ANY($1::uuid[])`,
    [flightIds]
  )
  if ((r2.rowCount || 0) > 0) console.log('SSIM Import: Deleted', r2.rowCount, 'aircraft_route_legs')

  // 5. Clean up orphaned aircraft_routes (routes with no remaining legs)
  await pool.query(
    `DELETE FROM aircraft_routes WHERE id IN (
      SELECT ar.id FROM aircraft_routes ar
      LEFT JOIN aircraft_route_legs arl ON arl.route_id = ar.id
      WHERE arl.id IS NULL AND ar.operator_id = $1 AND ar.season_id = $2
    )`,
    [operatorId, seasonId]
  )

  // 6. Now safe to delete parent scheduled_flights
  const result = await pool.query(
    `DELETE FROM scheduled_flights WHERE id = ANY($1::uuid[])`,
    [flightIds]
  )

  console.log('SSIM Import: Deleted', result.rowCount, 'scheduled_flights')
  return { deleted: result.rowCount || 0 }
}

// ─── ACTION 6: Finalize Import (Update References + Sync) ─────────
// Updates airport IDs, city pair IDs, seat capacity, then syncs to flight_numbers.

export async function finalizeImport(seasonId: string): Promise<{ synced: number }> {
  const operatorId = await getCurrentOperatorId()
  console.log('SSIM Import: Finalizing import — updating references for operator', operatorId, 'season', seasonId)

  // ── Update scheduled_flights references ──────────────────────
  const r1 = await pool.query(`
    UPDATE scheduled_flights sf SET dep_airport_id = a.id
    FROM airports a
    WHERE sf.dep_station = a.iata_code AND sf.dep_airport_id IS NULL
      AND sf.operator_id = $1 AND sf.season_id = $2
  `, [operatorId, seasonId])
  console.log('SSIM Import: Updated', r1.rowCount, 'dep_airport_id refs')

  const r2 = await pool.query(`
    UPDATE scheduled_flights sf SET arr_airport_id = a.id
    FROM airports a
    WHERE sf.arr_station = a.iata_code AND sf.arr_airport_id IS NULL
      AND sf.operator_id = $1 AND sf.season_id = $2
  `, [operatorId, seasonId])
  console.log('SSIM Import: Updated', r2.rowCount, 'arr_airport_id refs')

  const r3 = await pool.query(`
    UPDATE scheduled_flights sf SET city_pair_id = cp.id
    FROM city_pairs cp
    WHERE sf.dep_station = cp.departure_airport AND sf.arr_station = cp.arrival_airport
      AND sf.city_pair_id IS NULL
      AND sf.operator_id = $1 AND sf.season_id = $2
  `, [operatorId, seasonId])
  console.log('SSIM Import: Updated', r3.rowCount, 'city_pair_id refs')

  const r4 = await pool.query(`
    UPDATE scheduled_flights SET
      total_capacity = (
        SELECT COALESCE(SUM((value)::int), 0)
        FROM jsonb_each_text(seat_config)
      )
    WHERE operator_id = $1 AND season_id = $2
      AND total_capacity IS NULL AND seat_config IS NOT NULL
  `, [operatorId, seasonId])
  console.log('SSIM Import: Updated', r4.rowCount, 'seat capacities')

  // Count final results
  const countResult = await pool.query(
    'SELECT COUNT(*) FROM scheduled_flights WHERE operator_id = $1 AND season_id = $2',
    [operatorId, seasonId]
  )
  const total = parseInt(countResult.rows[0].count) || 0
  console.log('SSIM Import: Total scheduled_flights after finalize:', total)

  revalidatePath('/network/control/ssim')
  revalidatePath('/network/control/schedule-builder')
  console.log('SSIM Import: Finalization complete')
  return { synced: total }
}

// ─── Get Seasons ───────────────────────────────────────────────────

export async function getSeasons(): Promise<{ id: string; code: string; name: string; start_date: string; end_date: string }[]> {
  const operatorId = await getCurrentOperatorId()
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('schedule_seasons')
    .select('id, code, name, start_date, end_date')
    .eq('operator_id', operatorId)
    .order('start_date', { ascending: false })
  return data || []
}
