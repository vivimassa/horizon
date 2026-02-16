'use server'

import { Pool } from 'pg'
import { getCurrentOperatorId } from '@/lib/supabase/server'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Types ────────────────────────────────────────────────────

export interface AircraftRouteLeg {
  id: string
  route_id: string
  leg_sequence: number
  flight_id: string | null
  airline_code: string | null
  flight_number: number | null
  dep_station: string
  arr_station: string
  std_local: string
  sta_local: string
  dep_utc_offset: string | null
  arr_utc_offset: string | null
  block_minutes: number | null
  day_offset: number
  arrives_next_day: boolean
  service_type: string
}

export interface AircraftRoute {
  id: string
  operator_id: string
  season_id: string | null
  route_number: number
  route_name: string | null
  aircraft_type_id: string | null
  aircraft_type_icao: string | null
  days_of_operation: string
  period_start: string | null
  period_end: string | null
  duration_days: number
  status: string
  notes: string | null
  created_at: string
  updated_at: string
  // Joined fields
  aircraft_type_name: string | null
  legs: AircraftRouteLeg[]
  // Computed
  chain: string
  is_round_trip: boolean
  total_block_minutes: number
}

/**
 * Get all aircraft routes with their legs for a given season,
 * grouped by aircraft type for the left panel display.
 */
export async function getAircraftRoutes(seasonId: string): Promise<AircraftRoute[]> {
  const operatorId = await getCurrentOperatorId()

  // Fetch routes
  const routeRes = await pool.query(`
    SELECT
      r.*,
      at.name AS aircraft_type_name
    FROM aircraft_routes r
    LEFT JOIN aircraft_types at ON at.id = r.aircraft_type_id
    WHERE r.operator_id = $1
      AND r.season_id = $2
    ORDER BY r.aircraft_type_icao, r.route_name
  `, [operatorId, seasonId])

  if (!routeRes.rows.length) return []

  // Fetch all legs for these routes in one query
  const routeIds = routeRes.rows.map(r => r.id)
  const legRes = await pool.query(`
    SELECT
      id, route_id, leg_sequence, flight_id,
      airline_code, flight_number,
      dep_station, arr_station,
      to_char(std_local, 'HH24:MI') AS std_local,
      to_char(sta_local, 'HH24:MI') AS sta_local,
      dep_utc_offset, arr_utc_offset,
      block_minutes, day_offset, arrives_next_day, service_type
    FROM aircraft_route_legs
    WHERE route_id = ANY($1)
    ORDER BY route_id, leg_sequence
  `, [routeIds])

  // Group legs by route_id
  const legsByRoute = new Map<string, AircraftRouteLeg[]>()
  for (const leg of legRes.rows) {
    const arr = legsByRoute.get(leg.route_id) || []
    arr.push(leg)
    legsByRoute.set(leg.route_id, arr)
  }

  // Build result
  return routeRes.rows.map(r => {
    const legs = legsByRoute.get(r.id) || []

    // Build chain: "SGN → HAN → SGN"
    const chain = legs.length > 0
      ? legs.map(l => l.dep_station).concat(legs[legs.length - 1].arr_station).join(' → ')
      : ''

    // Round trip = last arrival == first departure
    const isRoundTrip = legs.length >= 2 &&
      legs[0].dep_station === legs[legs.length - 1].arr_station

    // Total block time
    const totalBlock = legs.reduce((sum, l) => sum + (l.block_minutes || 0), 0)

    return {
      ...r,
      period_start: r.period_start ? r.period_start.toISOString().slice(0, 10) : null,
      period_end: r.period_end ? r.period_end.toISOString().slice(0, 10) : null,
      legs,
      chain,
      is_round_trip: isRoundTrip,
      total_block_minutes: totalBlock,
    } as AircraftRoute
  })
}

/**
 * Count flights not linked to any route in the given season.
 */
export async function getUnassignedFlightCount(seasonId: string): Promise<number> {
  const operatorId = await getCurrentOperatorId()

  const res = await pool.query(`
    SELECT COUNT(*) AS cnt
    FROM scheduled_flights sf
    WHERE sf.operator_id = $1
      AND sf.season_id = $2
      AND NOT EXISTS (
        SELECT 1 FROM aircraft_route_legs arl
        WHERE arl.flight_id = sf.id
      )
  `, [operatorId, seasonId])

  return parseInt(res.rows[0]?.cnt || '0', 10)
}

/**
 * Create a new aircraft route.
 */
export async function createAircraftRoute(input: {
  season_id: string
  route_name?: string
  aircraft_type_id?: string
  aircraft_type_icao?: string
  days_of_operation?: string
  period_start?: string
  period_end?: string
}): Promise<{ id?: string; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  try {
    const res = await pool.query(`
      INSERT INTO aircraft_routes (
        operator_id, season_id, route_name, aircraft_type_id, aircraft_type_icao,
        days_of_operation, period_start, period_end
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      operatorId,
      input.season_id,
      input.route_name || null,
      input.aircraft_type_id || null,
      input.aircraft_type_icao || null,
      input.days_of_operation || '1234567',
      input.period_start || null,
      input.period_end || null,
    ])

    return { id: res.rows[0].id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Check for duplicate flights in scheduled_flights.
 * Returns info about the conflicting flight if found, or null if clean.
 */
export interface DuplicateFlightInfo {
  id: string
  flight_number: number
  dep_station: string
  arr_station: string
  period_start: string
  period_end: string
  route_name: string | null
}

export async function checkDuplicateFlight(input: {
  flight_number: number
  dep_station: string
  arr_station: string
  period_start: string
  period_end: string
  exclude_flight_ids: string[]
}): Promise<DuplicateFlightInfo | null> {
  const operatorId = await getCurrentOperatorId()

  const res = await pool.query(`
    SELECT
      sf.id,
      sf.flight_number,
      sf.dep_station,
      sf.arr_station,
      to_char(sf.period_start, 'YYYY-MM-DD') AS period_start,
      to_char(sf.period_end, 'YYYY-MM-DD') AS period_end,
      ar.route_name
    FROM scheduled_flights sf
    LEFT JOIN aircraft_route_legs arl ON arl.flight_id = sf.id
    LEFT JOIN aircraft_routes ar ON ar.id = arl.route_id
    WHERE sf.flight_number = $1
      AND sf.dep_station = $2
      AND sf.arr_station = $3
      AND sf.period_start <= $4::date
      AND sf.period_end >= $5::date
      AND sf.operator_id = $6
      AND sf.id != ALL($7::uuid[])
    LIMIT 1
  `, [
    input.flight_number,
    input.dep_station,
    input.arr_station,
    input.period_end,
    input.period_start,
    operatorId,
    input.exclude_flight_ids.length > 0 ? input.exclude_flight_ids : ['00000000-0000-0000-0000-000000000000'],
  ])

  if (!res.rows.length) return null
  return res.rows[0] as DuplicateFlightInfo
}

// ─── Save Route Input Types ──────────────────────────────────

export interface SaveRouteLegInput {
  flight_id: string | null
  airline_code: string | null
  flight_number: number | null
  dep_station: string
  arr_station: string
  std_local: string  // 'HH:MM'
  sta_local: string  // 'HH:MM'
  block_minutes: number | null
  day_offset: number
  arrives_next_day: boolean
  service_type: string
}

export interface SaveRouteInput {
  id: string | null // null → INSERT, non-null → UPDATE
  season_id: string
  route_name: string | null
  aircraft_type_id: string | null
  aircraft_type_icao: string | null
  days_of_operation: string
  period_start: string | null
  period_end: string | null
  duration_days: number
  status: string
  notes: string | null
  legs: SaveRouteLegInput[]
}

/**
 * Save (upsert) an aircraft route with all its legs.
 * Also syncs with scheduled_flights: creates new flights for legs without
 * a flight_id, and updates existing flights whose fields changed.
 */
export async function saveRoute(input: SaveRouteInput): Promise<{ id?: string; error?: string }> {
  if (input.legs.length === 0) return { error: 'Cannot save route with no legs' }

  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // a. UPSERT aircraft_routes
    let routeId = input.id

    if (routeId) {
      await client.query(`
        UPDATE aircraft_routes SET
          route_name = $2,
          aircraft_type_id = $3,
          aircraft_type_icao = $4,
          season_id = $5,
          days_of_operation = $6,
          period_start = $7,
          period_end = $8,
          duration_days = $9,
          status = $10,
          notes = $11,
          updated_at = NOW()
        WHERE id = $1 AND operator_id = $12
      `, [
        routeId, input.route_name || null,
        input.aircraft_type_id || null, input.aircraft_type_icao || null,
        input.season_id, input.days_of_operation,
        input.period_start || null, input.period_end || null,
        input.duration_days, input.status, input.notes || null,
        operatorId,
      ])
    } else {
      const ins = await client.query(`
        INSERT INTO aircraft_routes (
          operator_id, season_id, route_name, aircraft_type_id, aircraft_type_icao,
          days_of_operation, period_start, period_end, duration_days, status, notes
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING id
      `, [
        operatorId, input.season_id, input.route_name || null,
        input.aircraft_type_id || null, input.aircraft_type_icao || null,
        input.days_of_operation, input.period_start || null, input.period_end || null,
        input.duration_days, input.status, input.notes || null,
      ])
      routeId = ins.rows[0].id
    }

    // b. DELETE old legs
    await client.query('DELETE FROM aircraft_route_legs WHERE route_id = $1', [routeId])

    // c. INSERT new legs + d. SYNC scheduled_flights
    for (let i = 0; i < input.legs.length; i++) {
      const leg = input.legs[i]
      let flightId = leg.flight_id

      if (flightId) {
        // Update existing scheduled_flight
        await client.query(`
          UPDATE scheduled_flights SET
            airline_code = $2, flight_number = $3,
            dep_station = $4, arr_station = $5,
            std_local = $6::time, sta_local = $7::time,
            block_minutes = $8, days_of_operation = $9,
            period_start = $10::date, period_end = $11::date,
            aircraft_type_icao = $12, aircraft_type_id = $13,
            service_type = $14, arrival_day_offset = $15,
            updated_at = NOW()
          WHERE id = $1 AND operator_id = $16
        `, [
          flightId,
          leg.airline_code, leg.flight_number,
          leg.dep_station, leg.arr_station,
          leg.std_local, leg.sta_local,
          leg.block_minutes, input.days_of_operation,
          input.period_start, input.period_end,
          input.aircraft_type_icao, input.aircraft_type_id,
          leg.service_type, leg.arrives_next_day ? 1 : 0,
          operatorId,
        ])
      } else {
        // Create new scheduled_flight
        const sfRes = await client.query(`
          INSERT INTO scheduled_flights (
            operator_id, season_id, airline_code, flight_number,
            dep_station, arr_station, std_local, sta_local,
            block_minutes, days_of_operation, period_start, period_end,
            aircraft_type_icao, aircraft_type_id, service_type,
            arrival_day_offset, source, status,
            dep_airport_id, arr_airport_id
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7::time, $8::time, $9, $10,
            $11::date, $12::date, $13, $14, $15, $16, 'builder', 'draft',
            (SELECT id FROM airports WHERE iata_code = $5::varchar LIMIT 1),
            (SELECT id FROM airports WHERE iata_code = $6::varchar LIMIT 1)
          )
          RETURNING id
        `, [
          operatorId, input.season_id,
          leg.airline_code, leg.flight_number,
          leg.dep_station, leg.arr_station,
          leg.std_local, leg.sta_local,
          leg.block_minutes, input.days_of_operation,
          input.period_start, input.period_end,
          input.aircraft_type_icao, input.aircraft_type_id,
          leg.service_type, leg.arrives_next_day ? 1 : 0,
        ])
        flightId = sfRes.rows[0].id
      }

      // Insert route leg
      await client.query(`
        INSERT INTO aircraft_route_legs (
          route_id, leg_sequence, flight_id, airline_code, flight_number,
          dep_station, arr_station, std_local, sta_local,
          block_minutes, day_offset, arrives_next_day, service_type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::time,$9::time,$10,$11,$12,$13)
      `, [
        routeId, i + 1, flightId,
        leg.airline_code, leg.flight_number,
        leg.dep_station, leg.arr_station,
        leg.std_local, leg.sta_local,
        leg.block_minutes, leg.day_offset,
        leg.arrives_next_day, leg.service_type,
      ])
    }

    await client.query('COMMIT')
    return { id: routeId! }
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

/**
 * Delete an aircraft route, its legs, and any builder-created flights.
 */
export async function deleteRoute(routeId: string): Promise<{ error?: string }> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Get builder-created flight IDs from the legs
    const legRes = await client.query(`
      SELECT arl.flight_id
      FROM aircraft_route_legs arl
      WHERE arl.route_id = $1
        AND arl.flight_id IS NOT NULL
    `, [routeId])
    const flightIds = legRes.rows.map(r => r.flight_id)

    // Delete route (CASCADE deletes legs)
    const delRes = await client.query(
      'DELETE FROM aircraft_routes WHERE id = $1 AND operator_id = $2',
      [routeId, operatorId]
    )
    if (delRes.rowCount === 0) {
      await client.query('ROLLBACK')
      return { error: 'Route not found' }
    }

    // Delete only builder-created flights (not SSIM-imported ones)
    if (flightIds.length > 0) {
      await client.query(`
        DELETE FROM scheduled_flights
        WHERE id = ANY($1) AND source = 'builder'
      `, [flightIds])
    }

    await client.query('COMMIT')
    return {}
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

/**
 * Publish or unpublish a route and its associated flights.
 */
export async function publishRoute(routeId: string, publish: boolean): Promise<{ error?: string }> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()
  const newStatus = publish ? 'published' : 'draft'

  try {
    await client.query('BEGIN')

    await client.query(
      'UPDATE aircraft_routes SET status = $1, updated_at = NOW() WHERE id = $2 AND operator_id = $3',
      [newStatus, routeId, operatorId]
    )

    // Update linked flights' status
    await client.query(`
      UPDATE scheduled_flights SET status = $1, updated_at = NOW()
      WHERE id IN (
        SELECT flight_id FROM aircraft_route_legs
        WHERE route_id = $2 AND flight_id IS NOT NULL
      )
    `, [newStatus, routeId])

    await client.query('COMMIT')
    return {}
  } catch (err) {
    await client.query('ROLLBACK')
    return { error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

/**
 * Recent routes (last 8 by updated_at) for the quick-access cards.
 */
export interface RecentRoute {
  id: string
  route_name: string | null
  aircraft_type_icao: string | null
  days_of_operation: string
  status: string
  leg_count: number
  total_block_minutes: number
  chain: string
  is_round_trip: boolean
  updated_at: string
}

export async function getRecentRoutes(): Promise<RecentRoute[]> {
  const operatorId = await getCurrentOperatorId()

  const routeRes = await pool.query(`
    SELECT
      ar.id, ar.route_name, ar.aircraft_type_icao,
      ar.days_of_operation, ar.status, ar.updated_at
    FROM aircraft_routes ar
    WHERE ar.operator_id = $1
    ORDER BY ar.updated_at DESC
    LIMIT 8
  `, [operatorId])

  if (!routeRes.rows.length) return []

  const routeIds = routeRes.rows.map(r => r.id)
  const legRes = await pool.query(`
    SELECT route_id, dep_station, arr_station, block_minutes, leg_sequence
    FROM aircraft_route_legs
    WHERE route_id = ANY($1)
    ORDER BY route_id, leg_sequence
  `, [routeIds])

  const legsByRoute = new Map<string, typeof legRes.rows>()
  for (const leg of legRes.rows) {
    const arr = legsByRoute.get(leg.route_id) || []
    arr.push(leg)
    legsByRoute.set(leg.route_id, arr)
  }

  return routeRes.rows.map(r => {
    const legs = legsByRoute.get(r.id) || []
    const chain = legs.length > 0
      ? legs.map(l => l.dep_station).concat(legs[legs.length - 1].arr_station).join(' \u2192 ')
      : ''
    const isRoundTrip = legs.length >= 2 && legs[0].dep_station === legs[legs.length - 1].arr_station
    const totalBlock = legs.reduce((sum: number, l: { block_minutes: number | null }) => sum + (l.block_minutes || 0), 0)

    return {
      id: r.id,
      route_name: r.route_name,
      aircraft_type_icao: r.aircraft_type_icao,
      days_of_operation: r.days_of_operation,
      status: r.status,
      leg_count: legs.length,
      total_block_minutes: totalBlock,
      chain,
      is_round_trip: isRoundTrip,
      updated_at: r.updated_at?.toISOString?.() || r.updated_at,
    } as RecentRoute
  })
}

// ─── Route Templates ─────────────────────────────────────────

export interface RouteTemplateLeg {
  airline_code: string | null
  flight_number: number | null
  dep_station: string
  arr_station: string
  std_local: string
  sta_local: string
  block_minutes: number | null
  service_type: string
}

export interface RouteTemplate {
  id: string
  chain: string
  aircraft_type_icao: string | null
  aircraft_type_id: string | null
  days_of_operation: string
  leg_count: number
  total_block_minutes: number
  legs: RouteTemplateLeg[]
  usage_count: number
}

/**
 * Get distinct route templates (unique chain + AC type patterns).
 * Uses the most recent route per pattern as the representative.
 */
export async function getRouteTemplates(): Promise<RouteTemplate[]> {
  const operatorId = await getCurrentOperatorId()

  const routeRes = await pool.query(`
    SELECT ar.id, ar.aircraft_type_icao, ar.aircraft_type_id, ar.days_of_operation, ar.updated_at
    FROM aircraft_routes ar
    WHERE ar.operator_id = $1
    ORDER BY ar.updated_at DESC
  `, [operatorId])

  if (!routeRes.rows.length) return []

  const routeIds = routeRes.rows.map(r => r.id)
  const legRes = await pool.query(`
    SELECT route_id, airline_code, flight_number, dep_station, arr_station,
           to_char(std_local, 'HH24:MI') AS std_local,
           to_char(sta_local, 'HH24:MI') AS sta_local,
           block_minutes, service_type, leg_sequence
    FROM aircraft_route_legs
    WHERE route_id = ANY($1)
    ORDER BY route_id, leg_sequence
  `, [routeIds])

  const legsByRoute = new Map<string, typeof legRes.rows>()
  for (const leg of legRes.rows) {
    const arr = legsByRoute.get(leg.route_id) || []
    arr.push(leg)
    legsByRoute.set(leg.route_id, arr)
  }

  // Deduplicate by chain + aircraft_type_icao (first seen = most recent)
  const seen = new Map<string, RouteTemplate>()
  const countMap = new Map<string, number>()

  for (const r of routeRes.rows) {
    const legs = legsByRoute.get(r.id) || []
    if (legs.length === 0) continue

    const chain = legs.map((l: { dep_station: string }) => l.dep_station)
      .concat(legs[legs.length - 1].arr_station).join('-')
    const key = `${chain}|${r.aircraft_type_icao || ''}`

    countMap.set(key, (countMap.get(key) || 0) + 1)

    if (!seen.has(key)) {
      const totalBlock = legs.reduce((sum: number, l: { block_minutes: number | null }) => sum + (l.block_minutes || 0), 0)
      seen.set(key, {
        id: r.id,
        chain,
        aircraft_type_icao: r.aircraft_type_icao,
        aircraft_type_id: r.aircraft_type_id,
        days_of_operation: r.days_of_operation,
        leg_count: legs.length,
        total_block_minutes: totalBlock,
        legs: legs.map((l: { airline_code: string | null; flight_number: number | null; dep_station: string; arr_station: string; std_local: string; sta_local: string; block_minutes: number | null; service_type: string }) => ({
          airline_code: l.airline_code,
          flight_number: l.flight_number,
          dep_station: l.dep_station,
          arr_station: l.arr_station,
          std_local: l.std_local,
          sta_local: l.sta_local,
          block_minutes: l.block_minutes,
          service_type: l.service_type || 'J',
        })),
        usage_count: 0,
      })
    }
  }

  const templates = Array.from(seen.values()).map(tmpl => ({
    ...tmpl,
    usage_count: countMap.get(`${tmpl.chain}|${tmpl.aircraft_type_icao || ''}`) || 1,
  }))

  return templates.slice(0, 12)
}
