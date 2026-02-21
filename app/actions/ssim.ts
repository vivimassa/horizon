'use server'

import { Pool } from 'pg'
import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

/** Import parsed SSIM records into scheduled_flights for a given season */
export async function importSsimRecords(input: {
  season_id: string
  filename: string | null
  records: {
    flightNumber: string
    departureIata: string
    arrivalIata: string
    std: string
    sta: string
    daysOfWeek: string
    aircraftType: string
    serviceType: string
    effectiveFrom: string
    effectiveTo: string
  }[]
}): Promise<{
  newCount: number
  updatedCount: number
  unchangedCount: number
  errorCount: number
  errors: string[]
  missingAircraftTypes?: string[]
}> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  let newCount = 0, updatedCount = 0, unchangedCount = 0, errorCount = 0
  const errors: string[] = []

  // Fetch existing scheduled_flights for this season
  const existing = await pool.query(
    `SELECT id, airline_code || flight_number::text AS flight_number,
            dep_station, arr_station,
            to_char(std_utc::time, 'HH24MI') AS std,
            to_char(sta_utc::time, 'HH24MI') AS sta,
            days_of_operation, aircraft_type_id, service_type
     FROM scheduled_flights
     WHERE season_id = $1 AND operator_id = $2`,
    [input.season_id, operatorId]
  )
  const existingMap = new Map<string, (typeof existing.rows)[0]>()
  existing.rows.forEach((e: { flight_number: string }) => existingMap.set(e.flight_number, e))

  // Lookup aircraft types by IATA code
  const { data: acTypes } = await supabase
    .from('aircraft_types')
    .select('id, iata_type, icao_type')

  const acByIata = new Map<string, string>()
  const acByIcao = new Map<string, string>()
  acTypes?.forEach(t => {
    if (t.iata_type) acByIata.set(t.iata_type, t.id)
    acByIcao.set(t.icao_type, t.id)
  })

  // Pre-validate: block import if any aircraft types are missing
  const uniqueAcTypes = Array.from(new Set(input.records.map(r => r.aircraftType).filter(Boolean)))
  const missingTypes: string[] = []
  for (const t of uniqueAcTypes) {
    if (!acByIata.get(t) && !acByIcao.get(t)) {
      missingTypes.push(t)
    }
  }
  if (missingTypes.length > 0) {
    return {
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      errorCount: input.records.length,
      errors: [`Import blocked: aircraft type(s) not found in database: ${missingTypes.join(', ')}. Please add these types in Admin → Master Database → Aircraft Types before importing.`],
      missingAircraftTypes: missingTypes,
    }
  }

  // Validate airport codes
  const { data: airports } = await supabase.from('airports').select('iata_code')
  const validAirports = new Set(airports?.map(a => a.iata_code).filter(Boolean))

  for (const rec of input.records) {
    if (!validAirports.has(rec.departureIata)) {
      errors.push(`${rec.flightNumber}: Unknown departure airport ${rec.departureIata}`)
      errorCount++
      continue
    }
    if (!validAirports.has(rec.arrivalIata)) {
      errors.push(`${rec.flightNumber}: Unknown arrival airport ${rec.arrivalIata}`)
      errorCount++
      continue
    }

    const acTypeId = acByIata.get(rec.aircraftType) || acByIcao.get(rec.aircraftType) || null

    let blockMinutes = 0
    if (rec.std && rec.sta) {
      const depMins = parseInt(rec.std.slice(0, 2)) * 60 + parseInt(rec.std.slice(2))
      const arrMins = parseInt(rec.sta.slice(0, 2)) * 60 + parseInt(rec.sta.slice(2))
      blockMinutes = arrMins >= depMins ? arrMins - depMins : (1440 - depMins) + arrMins
    }

    // Split flight number: "VJ120" -> airline_code="VJ", flight_number=120
    const fnMatch = rec.flightNumber.match(/^([A-Z]{2})(\d+)$/)
    const airlineCode = fnMatch ? fnMatch[1] : rec.flightNumber.slice(0, 2)
    const flightNum = fnMatch ? parseInt(fnMatch[2]) : parseInt(rec.flightNumber.replace(/\D/g, ''))

    const stdTime = rec.std.length === 4
      ? rec.std.slice(0, 2) + ':' + rec.std.slice(2)
      : rec.std
    const staTime = rec.sta.length === 4
      ? rec.sta.slice(0, 2) + ':' + rec.sta.slice(2)
      : rec.sta

    const existingFn = existingMap.get(rec.flightNumber)

    if (existingFn) {
      const changed =
        existingFn.dep_station !== rec.departureIata ||
        existingFn.arr_station !== rec.arrivalIata ||
        existingFn.std !== rec.std ||
        existingFn.sta !== rec.sta ||
        existingFn.days_of_operation !== rec.daysOfWeek ||
        existingFn.service_type !== (rec.serviceType || 'J')

      if (changed) {
        try {
          await pool.query(
            `UPDATE scheduled_flights SET
               dep_station = $1, arr_station = $2,
               std_utc = $3::time, sta_utc = $4::time,
               block_minutes = $5, days_of_operation = $6,
               aircraft_type_id = $7, service_type = $8,
               period_start = $9, period_end = $10,
               arrival_day_offset = $11, source = 'ssim',
               updated_at = NOW()
             WHERE id = $12`,
            [
              rec.departureIata, rec.arrivalIata,
              stdTime, staTime,
              blockMinutes, rec.daysOfWeek,
              acTypeId, rec.serviceType || 'J',
              rec.effectiveFrom || null, rec.effectiveTo || null,
              rec.sta && rec.std && parseInt(rec.sta) < parseInt(rec.std) ? 1 : 0,
              existingFn.id,
            ]
          )
          updatedCount++
        } catch (err) {
          errors.push(`${rec.flightNumber}: ${err instanceof Error ? err.message : String(err)}`)
          errorCount++
        }
      } else {
        unchangedCount++
      }
    } else {
      try {
        await pool.query(
          `INSERT INTO scheduled_flights (
             operator_id, season_id, airline_code, flight_number,
             dep_station, arr_station, std_utc, sta_utc,
             block_minutes, days_of_operation, aircraft_type_id, service_type,
             period_start, period_end, arrival_day_offset, source
           ) VALUES ($1,$2,$3,$4,$5,$6,$7::time,$8::time,$9,$10,$11,$12,$13,$14,$15,'ssim')`,
          [
            operatorId, input.season_id, airlineCode, flightNum,
            rec.departureIata, rec.arrivalIata, stdTime, staTime,
            blockMinutes, rec.daysOfWeek, acTypeId, rec.serviceType || 'J',
            rec.effectiveFrom || null, rec.effectiveTo || null,
            rec.sta && rec.std && parseInt(rec.sta) < parseInt(rec.std) ? 1 : 0,
          ]
        )
        newCount++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('23505')) { errors.push(`${rec.flightNumber}: Duplicate`); errorCount++ }
        else { errors.push(`${rec.flightNumber}: ${msg}`); errorCount++ }
      }
    }
  }

  // Log the import
  await supabase.from('ssim_imports').insert({
    operator_id: operatorId,
    season_id: input.season_id,
    filename: input.filename,
    direction: 'import',
    total_records: input.records.length,
    new_records: newCount,
    updated_records: updatedCount,
    unchanged_records: unchangedCount,
    error_records: errorCount,
    errors: errors.map(e => ({ message: e })),
  })

  revalidatePath('/network/control/schedule-builder')
  revalidatePath('/network/control/schedule-messages')
  return { newCount, updatedCount, unchangedCount, errorCount, errors }
}

/** Generate SSIM export data for a season (reads from scheduled_flights) */
export async function generateSsimExport(input: {
  season_id: string
  carrier_code: string
  season_code: string
  filter_aircraft_type?: string
}): Promise<{ content: string; count: number; error?: string }> {
  const operatorId = await getCurrentOperatorId()

  let query = `
    SELECT
      sf.airline_code || sf.flight_number::text AS flight_number,
      sf.dep_station AS departure_iata,
      sf.arr_station AS arrival_iata,
      to_char(sf.std_utc::time, 'HH24MI') AS std,
      to_char(sf.sta_utc::time, 'HH24MI') AS sta,
      sf.days_of_operation AS days_of_week,
      sf.service_type,
      sf.period_start AS effective_from,
      sf.period_end AS effective_until,
      at.iata_type AS aircraft_type_iata
    FROM scheduled_flights sf
    LEFT JOIN aircraft_types at ON at.id = sf.aircraft_type_id
    WHERE sf.season_id = $1 AND sf.operator_id = $2
  `
  const params: unknown[] = [input.season_id, operatorId]

  if (input.filter_aircraft_type) {
    query += ` AND sf.aircraft_type_id = $3`
    params.push(input.filter_aircraft_type)
  }

  query += ` ORDER BY sf.flight_number`

  const result = await pool.query(query, params)
  if (result.rows.length === 0) return { content: '', count: 0, error: 'No flights found' }

  const { generateSsim } = await import('@/lib/ssim')

  const flights = result.rows.map((fn: Record<string, string>) => ({
    flightNumber: fn.flight_number,
    departureIata: fn.departure_iata,
    arrivalIata: fn.arrival_iata,
    std: fn.std,
    sta: fn.sta,
    daysOfWeek: fn.days_of_week,
    aircraftTypeIata: fn.aircraft_type_iata || '',
    serviceType: fn.service_type,
    effectiveFrom: fn.effective_from || '',
    effectiveTo: fn.effective_until || '',
  }))

  const content = generateSsim(input.carrier_code, input.season_code, flights)

  // Log the export
  const supabase = createAdminClient()
  await supabase.from('ssim_imports').insert({
    operator_id: operatorId,
    season_id: input.season_id,
    direction: 'export',
    total_records: flights.length,
    new_records: 0,
    updated_records: 0,
    unchanged_records: flights.length,
    error_records: 0,
  })

  return { content, count: flights.length }
}
