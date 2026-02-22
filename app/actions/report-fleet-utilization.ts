'use server'

import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export interface FleetUtilizationRow {
  registration: string
  icaoType: string
  date: string              // YYYY-MM-DD
  blockMinutes: number      // total block minutes that day
  sectorCount: number       // flights that day
}

export async function getFleetUtilization(
  rangeStart: string,
  rangeEnd: string
): Promise<FleetUtilizationRow[]> {
  const sql = `
    WITH date_range AS (
      SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS flight_date
    ),
    expanded AS (
      SELECT
        sf.id AS flight_id,
        sf.flight_number,
        sf.dep_station,
        sf.arr_station,
        sf.block_minutes,
        COALESCE(sf.aircraft_type_icao, at.icao_type) AS icao_type,
        dr.flight_date,
        fta.aircraft_reg AS registration
      FROM scheduled_flights sf
      CROSS JOIN date_range dr
      LEFT JOIN aircraft_types at ON sf.aircraft_type_id = at.id
      LEFT JOIN flight_tail_assignments fta
        ON fta.scheduled_flight_id = sf.id
        AND fta.flight_date = dr.flight_date
      WHERE sf.period_start IS NOT NULL
        AND sf.period_end IS NOT NULL
        AND sf.period_start <= $2::date
        AND sf.period_end >= $1::date
        AND dr.flight_date >= sf.period_start
        AND dr.flight_date <= sf.period_end
        AND COALESCE(sf.status, 'draft') IN ('draft', 'ready', 'published')
        AND CASE EXTRACT(ISODOW FROM dr.flight_date)::int
          WHEN 1 THEN substring(sf.days_of_operation, 1, 1) = '1'
          WHEN 2 THEN substring(sf.days_of_operation, 2, 1) = '2'
          WHEN 3 THEN substring(sf.days_of_operation, 3, 1) = '3'
          WHEN 4 THEN substring(sf.days_of_operation, 4, 1) = '4'
          WHEN 5 THEN substring(sf.days_of_operation, 5, 1) = '5'
          WHEN 6 THEN substring(sf.days_of_operation, 6, 1) = '6'
          WHEN 7 THEN substring(sf.days_of_operation, 7, 1) = '7'
          ELSE false
        END
        AND NOT (sf.excluded_dates IS NOT NULL AND dr.flight_date::text = ANY(sf.excluded_dates))
    )
    SELECT
      e.registration,
      e.icao_type AS "icaoType",
      e.flight_date::text AS date,
      COALESCE(SUM(e.block_minutes), 0)::int AS "blockMinutes",
      COUNT(*)::int AS "sectorCount"
    FROM expanded e
    WHERE e.registration IS NOT NULL
    GROUP BY e.registration, e.icao_type, e.flight_date
    ORDER BY e.registration, e.flight_date
  `

  const { rows } = await pool.query(sql, [rangeStart, rangeEnd])
  return rows as FleetUtilizationRow[]
}
