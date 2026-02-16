'use server'

import { Pool } from 'pg'
import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FlightNumber } from '@/types/database'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/**
 * Get all flights for a season (unified: reads from scheduled_flights).
 * Returns data shaped as FlightNumber for backward-compat with Schedule Builder.
 */
export async function getFlightNumbers(seasonId: string): Promise<FlightNumber[]> {
  const result = await pool.query(
    `SELECT
       id, operator_id, season_id,
       airline_code || flight_number::text AS flight_number,
       suffix,
       dep_airport_id AS departure_airport_id,
       arr_airport_id AS arrival_airport_id,
       dep_station AS departure_iata,
       arr_station AS arrival_iata,
       std_local::text, sta_local::text,
       to_char(std_local, 'HH24MI') AS std,
       to_char(sta_local, 'HH24MI') AS sta,
       to_char(std_utc, 'HH24MI') AS std_utc,
       to_char(sta_utc, 'HH24MI') AS sta_utc,
       COALESCE(block_minutes, 0) AS block_minutes,
       COALESCE(arrival_day_offset, CASE WHEN sta_local < std_local THEN 1 ELSE 0 END) AS arrival_day_offset,
       days_of_operation,
       days_of_operation AS days_of_week,
       aircraft_type_id,
       aircraft_type_icao,
       cockpit_crew_required,
       cabin_crew_required,
       service_type,
       connecting_flight,
       COALESCE(status, 'draft') AS status,
       COALESCE(is_etops, false) AS is_etops,
       COALESCE(is_overwater, false) AS is_overwater,
       COALESCE(is_active, true) AS is_active,
       to_char(period_start, 'YYYY-MM-DD') AS effective_from,
       to_char(period_end, 'YYYY-MM-DD') AS effective_until,
       created_at,
       updated_at,
       source
     FROM scheduled_flights
     WHERE season_id = $1
     ORDER BY flight_number`,
    [seasonId]
  )
  return result.rows as FlightNumber[]
}

/**
 * Create or update a flight (writes to scheduled_flights with source='manual').
 */
export async function saveFlightNumber(input: {
  id?: string
  season_id: string
  flight_number: string
  departure_iata: string
  arrival_iata: string
  std: string
  sta: string
  block_minutes: number
  days_of_week: string
  aircraft_type_id: string | null
  service_type: string
  effective_from: string | null
  effective_until: string | null
  arrival_day_offset: number
}): Promise<{ id?: string; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  // Split combined flight number (e.g. "VJ120") into airline_code + flight_number
  const match = input.flight_number.match(/^([A-Z]{2})(\d+)$/)
  if (!match) return { error: 'Invalid flight number format (expected e.g. VJ120)' }
  const airlineCode = match[1]
  const flightNum = parseInt(match[2])

  // Convert HHMM to HH:MM for TIME column
  const stdTime = input.std.length === 4
    ? input.std.slice(0, 2) + ':' + input.std.slice(2)
    : input.std
  const staTime = input.sta.length === 4
    ? input.sta.slice(0, 2) + ':' + input.sta.slice(2)
    : input.sta

  // Look up airport IDs
  const supabase = createAdminClient()
  const { data: depAirport } = await supabase
    .from('airports')
    .select('id')
    .eq('iata_code', input.departure_iata)
    .maybeSingle()
  const { data: arrAirport } = await supabase
    .from('airports')
    .select('id')
    .eq('iata_code', input.arrival_iata)
    .maybeSingle()

  try {
    if (input.id) {
      // Update existing
      await pool.query(
        `UPDATE scheduled_flights SET
           airline_code = $1, flight_number = $2,
           dep_station = $3, arr_station = $4,
           std_local = $5::time, sta_local = $6::time,
           block_minutes = $7, days_of_operation = $8,
           aircraft_type_id = $9, service_type = $10,
           period_start = $11, period_end = $12,
           arrival_day_offset = $13,
           dep_airport_id = $14, arr_airport_id = $15,
           updated_at = NOW()
         WHERE id = $16`,
        [
          airlineCode, flightNum,
          input.departure_iata, input.arrival_iata,
          stdTime, staTime,
          input.block_minutes, input.days_of_week,
          input.aircraft_type_id || null, input.service_type,
          input.effective_from || null, input.effective_until || null,
          input.arrival_day_offset,
          depAirport?.id || null, arrAirport?.id || null,
          input.id,
        ]
      )
      return { id: input.id }
    } else {
      // Insert new
      const result = await pool.query(
        `INSERT INTO scheduled_flights (
           operator_id, season_id, airline_code, flight_number,
           dep_station, arr_station, std_local, sta_local,
           block_minutes, days_of_operation, aircraft_type_id, service_type,
           period_start, period_end, arrival_day_offset,
           dep_airport_id, arr_airport_id, source
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::time,$8::time,$9,$10,$11,$12,$13,$14,$15,$16,$17,'manual')
         RETURNING id`,
        [
          operatorId, input.season_id, airlineCode, flightNum,
          input.departure_iata, input.arrival_iata, stdTime, staTime,
          input.block_minutes, input.days_of_week,
          input.aircraft_type_id || null, input.service_type,
          input.effective_from || null, input.effective_until || null,
          input.arrival_day_offset,
          depAirport?.id || null, arrAirport?.id || null,
        ]
      )
      return { id: result.rows[0]?.id }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('duplicate') || msg.includes('23505')) {
      return { error: 'Duplicate flight number in this season' }
    }
    return { error: msg }
  }
}

/**
 * Delete flights from scheduled_flights.
 */
export async function deleteFlightNumbers(ids: string[]): Promise<{ error?: string }> {
  try {
    await pool.query('DELETE FROM scheduled_flights WHERE id = ANY($1)', [ids])
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Bulk update flights in scheduled_flights.
 */
export async function bulkUpdateFlightNumbers(
  ids: string[],
  changes: Record<string, unknown>
): Promise<{ error?: string }> {
  // Map field names from FlightNumber shape to scheduled_flights columns
  const colMap: Record<string, string> = {
    days_of_week: 'days_of_operation',
    departure_iata: 'dep_station',
    arrival_iata: 'arr_station',
    effective_from: 'period_start',
    effective_until: 'period_end',
  }

  const setClauses: string[] = []
  const values: unknown[] = []
  let idx = 1

  for (const [key, val] of Object.entries(changes)) {
    const col = colMap[key] || key
    setClauses.push(`${col} = $${idx}`)
    values.push(val)
    idx++
  }

  if (setClauses.length === 0) return {}

  setClauses.push(`updated_at = NOW()`)
  values.push(ids)

  try {
    await pool.query(
      `UPDATE scheduled_flights SET ${setClauses.join(', ')} WHERE id = ANY($${idx})`,
      values
    )
    revalidatePath('/network/control/schedule-builder')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
}
