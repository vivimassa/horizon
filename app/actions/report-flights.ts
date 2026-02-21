'use server'

import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export interface DailyFlightRow {
  id: string
  airlineCode: string
  flightNumber: number
  depStation: string
  arrStation: string
  stdUtc: string
  staUtc: string
  blockMinutes: number
  aircraftTypeIcao: string | null
  serviceType: string
  status: string
  routeType: string | null
  daysOfOperation: string
  depUtcOffset: string | null
  arrUtcOffset: string | null
  seatConfig: string | null
  periodStart: string
  periodEnd: string
  excludedDates: string[]
}

export interface DailyFlightFilters {
  aircraftType?: string
  station?: string
  serviceType?: string
  status?: string
  routeType?: string
}

export async function getDailyFlightSchedule(
  rangeStart: string,
  rangeEnd: string,
  filters?: DailyFlightFilters
): Promise<DailyFlightRow[]> {
  const params: unknown[] = [rangeStart, rangeEnd]
  const conditions: string[] = [
    `sf.period_start IS NOT NULL AND sf.period_end IS NOT NULL`,
    `sf.period_start <= $2::date AND sf.period_end >= $1::date`,
    `COALESCE(sf.status, 'draft') IN ('draft', 'ready', 'published')`,
  ]

  let paramIdx = 3

  if (filters?.aircraftType) {
    conditions.push(`at.icao_type = $${paramIdx}`)
    params.push(filters.aircraftType)
    paramIdx++
  }

  if (filters?.station) {
    conditions.push(`(sf.dep_station ILIKE $${paramIdx} OR sf.arr_station ILIKE $${paramIdx})`)
    params.push(`%${filters.station}%`)
    paramIdx++
  }

  if (filters?.serviceType) {
    conditions.push(`COALESCE(sf.service_type, 'J') = $${paramIdx}`)
    params.push(filters.serviceType)
    paramIdx++
  }

  if (filters?.status) {
    conditions.push(`COALESCE(sf.status, 'draft') = $${paramIdx}`)
    params.push(filters.status)
    paramIdx++
  }

  if (filters?.routeType) {
    conditions.push(`cp.route_type = $${paramIdx}`)
    params.push(filters.routeType)
    paramIdx++
  }

  const result = await pool.query(
    `SELECT
       sf.id,
       sf.airline_code,
       sf.flight_number,
       sf.dep_station,
       sf.arr_station,
       to_char(sf.std_utc::time, 'HH24:MI') AS std_utc,
       to_char(sf.sta_utc::time, 'HH24:MI') AS sta_utc,
       COALESCE(sf.block_minutes, 0) AS block_minutes,
       at.icao_type AS aircraft_type_icao,
       COALESCE(sf.service_type, 'J') AS service_type,
       COALESCE(sf.status, 'draft') AS status,
       cp.route_type,
       sf.days_of_operation,
       dep_apt.utc_offset_hours AS dep_utc_offset,
       arr_apt.utc_offset_hours AS arr_utc_offset,
       NULL AS seat_config,
       to_char(sf.period_start, 'YYYY-MM-DD') AS period_start,
       to_char(sf.period_end, 'YYYY-MM-DD') AS period_end,
       COALESCE(sf.excluded_dates, '{}') AS excluded_dates
     FROM scheduled_flights sf
     LEFT JOIN aircraft_types at ON sf.aircraft_type_id = at.id
     LEFT JOIN LATERAL (
       SELECT route_type FROM city_pairs
       WHERE id = sf.city_pair_id
       UNION ALL
       SELECT route_type FROM city_pairs
       WHERE departure_airport = sf.dep_station AND arrival_airport = sf.arr_station
       UNION ALL
       SELECT route_type FROM city_pairs
       WHERE departure_airport_id = sf.dep_airport_id
         AND arrival_airport_id = sf.arr_airport_id
         AND sf.dep_airport_id IS NOT NULL
       LIMIT 1
     ) cp ON true
     LEFT JOIN airports dep_apt ON dep_apt.id = sf.dep_airport_id
     LEFT JOIN airports arr_apt ON arr_apt.id = sf.arr_airport_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY sf.flight_number, sf.dep_station`,
    params
  )

  return result.rows.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    airlineCode: (r.airline_code as string) || '',
    flightNumber: Number(r.flight_number),
    depStation: r.dep_station as string,
    arrStation: r.arr_station as string,
    stdUtc: r.std_utc as string,
    staUtc: r.sta_utc as string,
    blockMinutes: Number(r.block_minutes),
    aircraftTypeIcao: (r.aircraft_type_icao as string) || null,
    serviceType: (r.service_type as string) || 'J',
    status: r.status as string,
    routeType: (r.route_type as string) || null,
    daysOfOperation: r.days_of_operation as string,
    depUtcOffset: (r.dep_utc_offset as string) || null,
    arrUtcOffset: (r.arr_utc_offset as string) || null,
    seatConfig: (r.seat_config as string) || null,
    periodStart: r.period_start as string,
    periodEnd: r.period_end as string,
    excludedDates: ((r.excluded_dates as (string | Date)[]) || []).map(d => {
      if (d instanceof Date) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dy = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${dy}`
      }
      return String(d).slice(0, 10)
    }),
  }))
}
