'use server'

import { Pool } from 'pg'
import { getCurrentOperatorId } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import {
  generateSSIM,
  icaoToIataAircraftType,
  type SSIMFlightRecord,
  type SSIMExportOptions,
} from '@/lib/utils/ssim-generator'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// ─── Lookup Data ────────────────────────────────────────────────────

export async function getAirportOptions(): Promise<{ value: string; label: string }[]> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  const { data } = await supabase
    .from('airports')
    .select('iata_code, name')
    .eq('operator_id', operatorId)
    .not('iata_code', 'is', null)
    .order('iata_code')
  return (data || []).map(a => ({
    value: a.iata_code!,
    label: `${a.iata_code} — ${a.name}`,
  }))
}

export async function getServiceTypeOptions(): Promise<{ value: string; label: string }[]> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  const { data } = await supabase
    .from('flight_service_types')
    .select('code, name')
    .eq('operator_id', operatorId)
    .order('code')
  return (data || []).map(t => ({
    value: t.code,
    label: `${t.code} — ${t.name}`,
  }))
}

// ─── Types ─────────────────────────────────────────────────────────

export interface ExportFilters {
  seasonId: string
  dateFrom?: string
  dateTo?: string
  serviceTypes?: string[]
  flightNumberFrom?: number
  flightNumberTo?: number
  depStations?: string[]
  arrStations?: string[]
  actionCode?: string
}

export interface ExportPreview {
  totalFlights: number
  uniqueFlightNumbers: number
  uniqueRoutes: number
  dateRange: { start: string; end: string }
  aircraftTypes: string[]
  serviceTypes: Record<string, number>
  sampleLines: string[]
}

// ─── Get Export Data ────────────────────────────────────────────────

export async function getExportPreview(filters: ExportFilters): Promise<ExportPreview> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()

  try {
    const { query, params } = buildExportQuery(operatorId, filters)
    const { rows } = await client.query(query, params)

    if (rows.length === 0) {
      return {
        totalFlights: 0,
        uniqueFlightNumbers: 0,
        uniqueRoutes: 0,
        dateRange: { start: '', end: '' },
        aircraftTypes: [],
        serviceTypes: {},
        sampleLines: [],
      }
    }

    // Compute stats
    const flightNums = new Set(rows.map((r: any) => `${r.airline_code}${r.flight_number}`))
    const routes = new Set(rows.map((r: any) => `${r.dep_station}-${r.arr_station}`))
    const acTypes = new Set(rows.map((r: any) => r.aircraft_type_icao).filter(Boolean))

    const serviceTypes: Record<string, number> = {}
    rows.forEach((r: any) => {
      const st = r.service_type || 'J'
      serviceTypes[st] = (serviceTypes[st] || 0) + 1
    })

    const starts = rows.map((r: any) => r.period_start).filter(Boolean).sort()
    const ends = rows.map((r: any) => r.period_end).filter(Boolean).sort()

    // Generate a few sample lines
    const options = await buildExportOptions(operatorId, filters)
    const sampleFlights = rows.slice(0, 5).map(rowToFlightRecord)
    const sampleSsim = generateSSIM(sampleFlights, options)
    const sampleLines = sampleSsim.split('\n').slice(0, 7) // header + carrier + first 5 flights

    return {
      totalFlights: rows.length,
      uniqueFlightNumbers: flightNums.size,
      uniqueRoutes: routes.size,
      dateRange: {
        start: starts[0] || '',
        end: ends[ends.length - 1] || '',
      },
      aircraftTypes: Array.from(acTypes).sort() as string[],
      serviceTypes,
      sampleLines,
    }
  } finally {
    client.release()
  }
}

// ─── Generate Export File ──────────────────────────────────────────

export async function generateExportFile(filters: ExportFilters): Promise<string> {
  const operatorId = await getCurrentOperatorId()
  const client = await pool.connect()

  try {
    const { query, params } = buildExportQuery(operatorId, filters)
    const { rows } = await client.query(query, params)

    const options = await buildExportOptions(operatorId, filters)
    const flights = rows.map(rowToFlightRecord)

    return generateSSIM(flights, options)
  } finally {
    client.release()
  }
}

// ─── Helpers ───────────────────────────────────────────────────────

function buildExportQuery(operatorId: string, filters: ExportFilters): { query: string; params: unknown[] } {
  const conditions: string[] = ['sf.operator_id = $1', 'sf.season_id = $2']
  const params: unknown[] = [operatorId, filters.seasonId]
  let paramIdx = 3

  if (filters.dateFrom) {
    conditions.push(`sf.period_end >= $${paramIdx}`)
    params.push(filters.dateFrom)
    paramIdx++
  }

  if (filters.dateTo) {
    conditions.push(`sf.period_start <= $${paramIdx}`)
    params.push(filters.dateTo)
    paramIdx++
  }

  if (filters.serviceTypes && filters.serviceTypes.length > 0) {
    conditions.push(`sf.service_type = ANY($${paramIdx})`)
    params.push(filters.serviceTypes)
    paramIdx++
  }

  if (filters.flightNumberFrom != null) {
    conditions.push(`sf.flight_number >= $${paramIdx}`)
    params.push(filters.flightNumberFrom)
    paramIdx++
  }

  if (filters.flightNumberTo != null) {
    conditions.push(`sf.flight_number <= $${paramIdx}`)
    params.push(filters.flightNumberTo)
    paramIdx++
  }

  if (filters.depStations && filters.depStations.length > 0) {
    conditions.push(`sf.dep_station = ANY($${paramIdx})`)
    params.push(filters.depStations)
    paramIdx++
  }

  if (filters.arrStations && filters.arrStations.length > 0) {
    conditions.push(`sf.arr_station = ANY($${paramIdx})`)
    params.push(filters.arrStations)
    paramIdx++
  }

  const query = `
    SELECT
      sf.airline_code,
      sf.flight_number,
      sf.itinerary_variation,
      sf.leg_sequence,
      sf.service_type,
      sf.period_start,
      sf.period_end,
      sf.days_of_operation,
      sf.dep_station,
      sf.std_local,
      sf.dep_utc_offset,
      sf.arr_station,
      sf.sta_local,
      sf.arr_utc_offset,
      sf.aircraft_type_icao,
      sf.seat_config
    FROM scheduled_flights sf
    WHERE ${conditions.join(' AND ')}
    ORDER BY sf.flight_number, sf.itinerary_variation, sf.leg_sequence, sf.period_start
  `

  return { query, params }
}

async function buildExportOptions(operatorId: string, filters: ExportFilters): Promise<SSIMExportOptions> {
  const supabase = createAdminClient()

  // Get operator info
  const { data: operator } = await supabase
    .from('operators')
    .select('iata_code, name')
    .eq('id', operatorId)
    .single()

  // Get season info
  const { data: season } = await supabase
    .from('schedule_seasons')
    .select('start_date, end_date')
    .eq('id', filters.seasonId)
    .single()

  return {
    airlineCode: operator?.iata_code || 'XX',
    airlineName: operator?.name || 'Unknown Airline',
    seasonStart: season?.start_date || '',
    seasonEnd: season?.end_date || '',
    actionCode: filters.actionCode || 'H',
  }
}

function rowToFlightRecord(row: any): SSIMFlightRecord {
  // Convert TIME format (HH:MM:SS) to HHMM
  const stdLocal = formatTimeToHHMM(row.std_local)
  const staLocal = formatTimeToHHMM(row.sta_local)

  // Resolve ICAO aircraft type to IATA
  const acIata = row.aircraft_type_icao
    ? icaoToIataAircraftType(row.aircraft_type_icao)
    : '   '

  return {
    airlineCode: row.airline_code || '',
    flightNumber: row.flight_number,
    itineraryVariation: row.itinerary_variation || '01',
    legSequence: row.leg_sequence || '01',
    serviceType: row.service_type || 'J',
    periodStart: row.period_start || '',
    periodEnd: row.period_end || '',
    daysOfOperation: row.days_of_operation || '       ',
    depStation: row.dep_station || '',
    stdLocal,
    depUtcOffset: row.dep_utc_offset || '+0000',
    arrStation: row.arr_station || '',
    staLocal,
    arrUtcOffset: row.arr_utc_offset || '+0000',
    aircraftTypeIata: acIata,
    seatConfig: row.seat_config || undefined,
  }
}

/** Convert PostgreSQL TIME "HH:MM:SS" or "HH:MM" → "HHMM" */
function formatTimeToHHMM(time: string | null): string {
  if (!time) return '0000'
  const parts = time.split(':')
  return `${(parts[0] || '00').padStart(2, '0')}${(parts[1] || '00').padStart(2, '0')}`
}
