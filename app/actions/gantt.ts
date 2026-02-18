'use server'

import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export interface GanttFlight {
  id: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  blockMinutes: number
  daysOfOperation: string
  status: string
  aircraftTypeIcao: string | null
  periodStart: string
  periodEnd: string
  scenarioId: string | null
  routeType: string | null
  routeId: string | null
  seasonId: string | null
  aircraftReg: string | null
  /** Departure day offset within route (0 = first day, 1 = next day, etc.) */
  dayOffset: number
  serviceType: string
  source: string
  finalized: boolean
}

export async function getGanttFlights(
  rangeStart: string,
  rangeEnd: string
): Promise<GanttFlight[]> {
  const result = await pool.query(
    `SELECT
       sf.id,
       sf.airline_code || sf.flight_number::text AS flight_number,
       sf.dep_station,
       sf.arr_station,
       to_char(sf.std_local, 'HH24:MI') AS std_local,
       to_char(sf.sta_local, 'HH24:MI') AS sta_local,
       COALESCE(sf.block_minutes, 0) AS block_minutes,
       sf.days_of_operation,
       COALESCE(sf.status, 'draft') AS status,
       at.icao_type AS aircraft_type_icao,
       to_char(sf.period_start, 'YYYY-MM-DD') AS period_start,
       to_char(sf.period_end, 'YYYY-MM-DD') AS period_end,
       sf.scenario_id,
       sf.season_id,
       sf.aircraft_reg,
       cp.route_type,
       arl.route_id,
       COALESCE(arl.day_offset, 0) AS day_offset,
       COALESCE(sf.service_type, 'J') AS service_type,
       COALESCE(sf.source, 'manual') AS source,
       COALESCE(sf.finalized, FALSE) AS finalized
     FROM scheduled_flights sf
     LEFT JOIN aircraft_types at ON sf.aircraft_type_id = at.id
     LEFT JOIN city_pairs cp ON cp.departure_airport = sf.dep_station
       AND cp.arrival_airport = sf.arr_station
     LEFT JOIN LATERAL (
       SELECT route_id, day_offset FROM aircraft_route_legs WHERE flight_id = sf.id LIMIT 1
     ) arl ON true
     WHERE (
       sf.period_start IS NOT NULL AND sf.period_end IS NOT NULL
       AND sf.period_start <= $2::date AND sf.period_end >= $1::date
     )
     AND COALESCE(sf.status, 'draft') IN ('draft', 'ready', 'published')
     ORDER BY sf.flight_number`,
    [rangeStart, rangeEnd]
  )

  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    flightNumber: r.flight_number as string,
    depStation: r.dep_station as string,
    arrStation: r.arr_station as string,
    stdLocal: r.std_local as string,
    staLocal: r.sta_local as string,
    blockMinutes: Number(r.block_minutes),
    daysOfOperation: r.days_of_operation as string,
    status: r.status as string,
    aircraftTypeIcao: r.aircraft_type_icao as string | null,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    scenarioId: r.scenario_id as string | null,
    routeType: (r.route_type as string) || null,
    routeId: (r.route_id as string) || null,
    seasonId: (r.season_id as string) || null,
    aircraftReg: (r.aircraft_reg as string) || null,
    dayOffset: Number(r.day_offset ?? 0),
    serviceType: (r.service_type as string) || 'J',
    source: (r.source as string) || 'manual',
    finalized: Boolean(r.finalized),
  }))
}

// ─── Route data for Mini Builder ──────────────────────────────

export interface GanttRouteData {
  id: string
  routeName: string | null
  aircraftTypeId: string | null
  aircraftTypeIcao: string | null
  seasonId: string | null
  scenarioId: string
  daysOfOperation: string
  periodStart: string | null
  periodEnd: string | null
  durationDays: number
  status: string
  notes: string | null
  legs: GanttRouteLeg[]
}

export interface GanttRouteLeg {
  id: string
  legSequence: number
  flightId: string | null
  airlineCode: string | null
  flightNumber: number | null
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  blockMinutes: number | null
  dayOffset: number
  arrivesNextDay: boolean
  serviceType: string
}

export async function getRouteWithLegs(routeId: string): Promise<GanttRouteData | null> {
  const routeRes = await pool.query(`
    SELECT
      r.id, r.route_name, r.aircraft_type_id, r.aircraft_type_icao,
      r.season_id, r.scenario_id, r.days_of_operation,
      to_char(r.period_start, 'YYYY-MM-DD') AS period_start,
      to_char(r.period_end, 'YYYY-MM-DD') AS period_end,
      r.duration_days, r.status, r.notes
    FROM aircraft_routes r
    WHERE r.id = $1
  `, [routeId])

  if (!routeRes.rows.length) return null
  const r = routeRes.rows[0]

  const legRes = await pool.query(`
    SELECT
      id, leg_sequence, flight_id,
      airline_code, flight_number,
      dep_station, arr_station,
      to_char(std_local, 'HH24:MI') AS std_local,
      to_char(sta_local, 'HH24:MI') AS sta_local,
      block_minutes, day_offset, arrives_next_day, service_type
    FROM aircraft_route_legs
    WHERE route_id = $1
    ORDER BY leg_sequence
  `, [routeId])

  return {
    id: r.id,
    routeName: r.route_name,
    aircraftTypeId: r.aircraft_type_id,
    aircraftTypeIcao: r.aircraft_type_icao,
    seasonId: r.season_id,
    scenarioId: r.scenario_id,
    daysOfOperation: r.days_of_operation,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    durationDays: r.duration_days ?? 1,
    status: r.status,
    notes: r.notes,
    legs: legRes.rows.map((l: Record<string, unknown>) => ({
      id: l.id as string,
      legSequence: l.leg_sequence as number,
      flightId: (l.flight_id as string) || null,
      airlineCode: (l.airline_code as string) || null,
      flightNumber: l.flight_number != null ? Number(l.flight_number) : null,
      depStation: l.dep_station as string,
      arrStation: l.arr_station as string,
      stdLocal: l.std_local as string,
      staLocal: l.sta_local as string,
      blockMinutes: l.block_minutes != null ? Number(l.block_minutes) : null,
      dayOffset: Number(l.day_offset ?? 0),
      arrivesNextDay: Boolean(l.arrives_next_day),
      serviceType: (l.service_type as string) || 'J',
    })),
  }
}

// ─── Delete a single flight (remove from route if linked) ─────

export async function deleteSingleFlight(
  flightId: string
): Promise<{ routeDeleted: boolean; error?: string }> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // 1. Check if this flight is part of a route
    const legRes = await client.query(
      `SELECT id, route_id FROM aircraft_route_legs WHERE flight_id = $1`,
      [flightId]
    )

    if (legRes.rows.length > 0) {
      const { route_id: routeId } = legRes.rows[0]

      // 2. Delete the leg row
      await client.query(
        `DELETE FROM aircraft_route_legs WHERE flight_id = $1`,
        [flightId]
      )

      // 3. Renumber remaining legs
      await client.query(`
        WITH numbered AS (
          SELECT id, ROW_NUMBER() OVER (ORDER BY leg_sequence) AS new_seq
          FROM aircraft_route_legs
          WHERE route_id = $1
        )
        UPDATE aircraft_route_legs SET leg_sequence = numbered.new_seq
        FROM numbered WHERE aircraft_route_legs.id = numbered.id
      `, [routeId])

      // 4. If route has 0 remaining legs → delete route
      const remaining = await client.query(
        `SELECT COUNT(*) AS cnt FROM aircraft_route_legs WHERE route_id = $1`,
        [routeId]
      )

      let routeDeleted = false
      if (parseInt(remaining.rows[0].cnt, 10) === 0) {
        await client.query(`DELETE FROM aircraft_routes WHERE id = $1`, [routeId])
        routeDeleted = true
      }

      // 5. Delete the scheduled flight (builder-created only)
      await client.query(
        `DELETE FROM scheduled_flights WHERE id = $1 AND source = 'builder'`,
        [flightId]
      )

      await client.query('COMMIT')
      return { routeDeleted }
    }

    // Not linked to any route — just delete the flight
    await client.query(
      `DELETE FROM scheduled_flights WHERE id = $1 AND source = 'builder'`,
      [flightId]
    )

    await client.query('COMMIT')
    return { routeDeleted: false }
  } catch (err) {
    await client.query('ROLLBACK')
    return { routeDeleted: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    client.release()
  }
}

// ─── Per-date tail assignment interface ──────────────────────

export interface FlightDateItem {
  flightId: string
  flightDate: string // YYYY-MM-DD
}

// ─── Assign flights to an aircraft registration (per date) ───

export async function assignFlightsToAircraft(
  items: FlightDateItem[],
  registration: string
): Promise<{ error?: string }> {
  if (items.length === 0) return {}
  try {
    // Upsert into flight_tail_assignments for each (flight, date) pair
    const values: string[] = []
    const params: unknown[] = [registration]
    for (let i = 0; i < items.length; i++) {
      const pi = i * 2 + 2
      values.push(`($${pi}::uuid, $${pi + 1}::date, $1)`)
      params.push(items[i].flightId, items[i].flightDate)
    }
    await pool.query(
      `INSERT INTO flight_tail_assignments (scheduled_flight_id, flight_date, aircraft_reg)
       VALUES ${values.join(', ')}
       ON CONFLICT (scheduled_flight_id, flight_date)
       DO UPDATE SET aircraft_reg = EXCLUDED.aircraft_reg`,
      params
    )
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Unassign tail from flights (per date) ───────────────────

export async function unassignFlightsTail(
  items: FlightDateItem[]
): Promise<{ error?: string }> {
  if (items.length === 0) return {}
  try {
    // Build WHERE clause for each (flight, date) pair
    const conditions: string[] = []
    const params: unknown[] = []
    for (let i = 0; i < items.length; i++) {
      const pi = i * 2 + 1
      conditions.push(`(scheduled_flight_id = $${pi}::uuid AND flight_date = $${pi + 1}::date)`)
      params.push(items[i].flightId, items[i].flightDate)
    }
    await pool.query(
      `DELETE FROM flight_tail_assignments WHERE ${conditions.join(' OR ')}`,
      params
    )
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ─── Load per-date tail assignments for a date range ─────────

export interface TailAssignmentRow {
  scheduledFlightId: string
  flightDate: string
  aircraftReg: string
}

export async function getFlightTailAssignments(
  rangeStart: string,
  rangeEnd: string
): Promise<TailAssignmentRow[]> {
  const result = await pool.query(
    `SELECT scheduled_flight_id, to_char(flight_date, 'YYYY-MM-DD') AS flight_date, aircraft_reg
     FROM flight_tail_assignments
     WHERE flight_date >= $1::date AND flight_date <= $2::date`,
    [rangeStart, rangeEnd]
  )
  return result.rows.map((r: Record<string, unknown>) => ({
    scheduledFlightId: r.scheduled_flight_id as string,
    flightDate: r.flight_date as string,
    aircraftReg: r.aircraft_reg as string,
  }))
}

// ─── Batch route fetch for clipboard ─────────────────────────

/**
 * Given a list of flight IDs, find all routes they belong to
 * and return each route with its full leg data (deduplicated by route_id).
 */
export async function getRoutesForFlights(flightIds: string[]): Promise<GanttRouteData[]> {
  if (flightIds.length === 0) return []

  // Find distinct route_ids for these flights
  const routeIdRes = await pool.query(
    `SELECT DISTINCT route_id FROM aircraft_route_legs WHERE flight_id = ANY($1::uuid[])`,
    [flightIds]
  )

  const routeIds = routeIdRes.rows
    .map((r: Record<string, unknown>) => r.route_id as string)
    .filter(Boolean)

  if (routeIds.length === 0) return []

  // Fetch each route with legs
  const results: GanttRouteData[] = []
  for (const routeId of routeIds) {
    const route = await getRouteWithLegs(routeId)
    if (route) results.push(route)
  }

  return results
}
