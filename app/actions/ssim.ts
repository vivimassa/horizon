'use server'

import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/** Import parsed SSIM records into flight_numbers for a given season */
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
}> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  let newCount = 0, updatedCount = 0, unchangedCount = 0, errorCount = 0
  const errors: string[] = []

  // Fetch existing flight numbers for this season
  const { data: existing } = await supabase
    .from('flight_numbers')
    .select('id, flight_number, departure_iata, arrival_iata, std, sta, days_of_week, aircraft_type_id, service_type')
    .eq('season_id', input.season_id)

  const existingMap = new Map<string, typeof existing extends (infer T)[] | null ? T : never>()
  existing?.forEach(e => existingMap.set(e.flight_number, e))

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

  // Validate airport codes
  const { data: airports } = await supabase.from('airports').select('iata_code')
  const validAirports = new Set(airports?.map(a => a.iata_code).filter(Boolean))

  for (const rec of input.records) {
    // Validate airports
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

    // Resolve aircraft type
    const acTypeId = acByIata.get(rec.aircraftType) || acByIcao.get(rec.aircraftType) || null

    // Calculate block minutes from times
    let blockMinutes = 0
    if (rec.std && rec.sta) {
      const depMins = parseInt(rec.std.slice(0, 2)) * 60 + parseInt(rec.std.slice(2))
      const arrMins = parseInt(rec.sta.slice(0, 2)) * 60 + parseInt(rec.sta.slice(2))
      blockMinutes = arrMins >= depMins ? arrMins - depMins : (1440 - depMins) + arrMins
    }

    const row = {
      operator_id: operatorId,
      season_id: input.season_id,
      flight_number: rec.flightNumber,
      departure_iata: rec.departureIata,
      arrival_iata: rec.arrivalIata,
      std: rec.std,
      sta: rec.sta,
      block_minutes: blockMinutes,
      days_of_week: rec.daysOfWeek,
      aircraft_type_id: acTypeId,
      service_type: rec.serviceType || 'J',
      effective_from: rec.effectiveFrom || null,
      effective_until: rec.effectiveTo || null,
      arrival_day_offset: rec.sta && rec.std && parseInt(rec.sta) < parseInt(rec.std) ? 1 : 0,
    }

    const existingFn = existingMap.get(rec.flightNumber)

    if (existingFn) {
      // Check if changed
      const changed =
        existingFn.departure_iata !== row.departure_iata ||
        existingFn.arrival_iata !== row.arrival_iata ||
        existingFn.std !== row.std ||
        existingFn.sta !== row.sta ||
        existingFn.days_of_week !== row.days_of_week ||
        existingFn.service_type !== row.service_type

      if (changed) {
        const { error } = await supabase
          .from('flight_numbers')
          .update(row)
          .eq('id', existingFn.id)
        if (error) { errors.push(`${rec.flightNumber}: ${error.message}`); errorCount++ }
        else updatedCount++
      } else {
        unchangedCount++
      }
    } else {
      const { error } = await supabase.from('flight_numbers').insert(row)
      if (error) {
        if (error.code === '23505') { errors.push(`${rec.flightNumber}: Duplicate`); errorCount++ }
        else { errors.push(`${rec.flightNumber}: ${error.message}`); errorCount++ }
      } else {
        newCount++
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

/** Generate SSIM export data for a season (returns raw content string) */
export async function generateSsimExport(input: {
  season_id: string
  carrier_code: string
  season_code: string
  filter_aircraft_type?: string
}): Promise<{ content: string; count: number; error?: string }> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  let query = supabase
    .from('flight_numbers')
    .select('*, aircraft_types(iata_type)')
    .eq('season_id', input.season_id)
    .order('flight_number', { ascending: true })

  if (input.filter_aircraft_type) {
    query = query.eq('aircraft_type_id', input.filter_aircraft_type)
  }

  const { data, error } = await query
  if (error) return { content: '', count: 0, error: error.message }
  if (!data || data.length === 0) return { content: '', count: 0, error: 'No flights found' }

  // Import generateSsim dynamically to avoid bundling issues
  const { generateSsim } = await import('@/lib/ssim')

  const flights = data.map(fn => ({
    flightNumber: fn.flight_number,
    departureIata: fn.departure_iata,
    arrivalIata: fn.arrival_iata,
    std: fn.std,
    sta: fn.sta,
    daysOfWeek: fn.days_of_week,
    aircraftTypeIata: (fn.aircraft_types as { iata_type: string | null } | null)?.iata_type || '',
    serviceType: fn.service_type,
    effectiveFrom: fn.effective_from || '',
    effectiveTo: fn.effective_until || '',
  }))

  const content = generateSsim(input.carrier_code, input.season_code, flights)

  // Log the export
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
