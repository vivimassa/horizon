'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Flight } from '@/types/database'

// ─── Helpers ─────────────────────────────────────────────────

/** Convert local HHMM + date + IANA timezone → UTC ISO string */
function localToUtc(dateStr: string, timeHHMM: string, timezone: string): string {
  if (!timeHHMM || timeHHMM.length !== 4) return new Date(dateStr + 'T00:00:00Z').toISOString()

  const h = parseInt(timeHHMM.slice(0, 2))
  const m = parseInt(timeHHMM.slice(2))
  const [year, month, day] = dateStr.split('-').map(Number)

  // Iterative convergence: find UTC instant whose local representation matches target
  let utcMs = Date.UTC(year, month - 1, day, h, m)

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(utcMs))

    const fY = parseInt(parts.find(p => p.type === 'year')?.value || '0')
    const fM = parseInt(parts.find(p => p.type === 'month')?.value || '0')
    const fD = parseInt(parts.find(p => p.type === 'day')?.value || '0')
    const fH = parseInt(parts.find(p => p.type === 'hour')?.value || '0')
    const fMin = parseInt(parts.find(p => p.type === 'minute')?.value || '0')

    const diff = Date.UTC(year, month - 1, day, h, m) - Date.UTC(fY, fM - 1, fD, fH, fMin)
    if (diff === 0) break
    utcMs += diff
  }

  return new Date(utcMs).toISOString()
}

function dateToDow(dateStr: string): string {
  const jsDay = new Date(dateStr + 'T12:00:00Z').getUTCDay()
  return String(jsDay === 0 ? 7 : jsDay)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

// ─── Actions ─────────────────────────────────────────────────

/** Count existing flights that would conflict with a publish */
export async function countConflicts(input: {
  flight_numbers: string[]
  start_date: string
  end_date: string
}): Promise<number> {
  const supabase = await createClient()
  const operatorId = await getCurrentOperatorId()
  const { count, error } = await supabase
    .from('flights')
    .select('*', { count: 'exact', head: true })
    .eq('operator_id', operatorId)
    .in('flight_number', input.flight_numbers)
    .gte('flight_date', input.start_date)
    .lte('flight_date', input.end_date)

  if (error) { console.error('Error counting conflicts:', error); return 0 }
  return count || 0
}

/** Publish (instantiate) flight_numbers into actual flight records */
export async function publishFlights(input: {
  flight_number_ids: string[]
  start_date: string
  end_date: string
  skip_existing: boolean
}): Promise<{ created: number; skipped: number; errors: number; error?: string }> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  // 1. Fetch selected flight number templates
  const { data: fnRows, error: fnErr } = await supabase
    .from('flight_numbers')
    .select('*')
    .in('id', input.flight_number_ids)

  if (fnErr || !fnRows) {
    return { created: 0, skipped: 0, errors: 0, error: fnErr?.message || 'Failed to fetch flight numbers' }
  }

  // 2. Build timezone lookup from airports
  const iatas = new Set<string>()
  fnRows.forEach(fn => { iatas.add(fn.departure_iata); iatas.add(fn.arrival_iata) })

  const { data: airportRows } = await supabase
    .from('airports')
    .select('iata_code, timezone')
    .in('iata_code', Array.from(iatas))

  const tzMap = new Map<string, string>()
  airportRows?.forEach(a => { if (a.iata_code) tzMap.set(a.iata_code, a.timezone) })

  // 3. Build set of existing flights to skip duplicates
  const existingSet = new Set<string>()
  if (input.skip_existing) {
    const { data: existing } = await supabase
      .from('flights')
      .select('flight_number, flight_date')
      .eq('operator_id', operatorId)
      .gte('flight_date', input.start_date)
      .lte('flight_date', input.end_date)
      .in('flight_number', fnRows.map(fn => fn.flight_number))

    existing?.forEach(e => existingSet.add(`${e.flight_number}|${e.flight_date}`))
  }

  // 4. Generate flight records
  interface FlightInsert {
    operator_id: string
    flight_number_id: string
    flight_number: string
    flight_date: string
    departure_iata: string
    arrival_iata: string
    std_utc: string
    sta_utc: string
    std_local: string
    sta_local: string
    block_minutes: number
    aircraft_type_id: string | null
    service_type: string
    status: string
    arrival_day_offset: number
  }

  const records: FlightInsert[] = []
  let skipped = 0

  for (const fn of fnRows) {
    let cur = input.start_date
    while (cur <= input.end_date) {
      const dow = dateToDow(cur)

      if (fn.days_of_week.includes(dow)) {
        const inRange =
          (!fn.effective_from || cur >= fn.effective_from) &&
          (!fn.effective_until || cur <= fn.effective_until)

        if (inRange) {
          const key = `${fn.flight_number}|${cur}`
          if (existingSet.has(key)) {
            skipped++
          } else {
            const depTz = tzMap.get(fn.departure_iata) || 'UTC'
            const arrTz = tzMap.get(fn.arrival_iata) || 'UTC'
            const arrDate = fn.arrival_day_offset > 0 ? addDays(cur, fn.arrival_day_offset) : cur

            records.push({
              operator_id: operatorId,
              flight_number_id: fn.id,
              flight_number: fn.flight_number,
              flight_date: cur,
              departure_iata: fn.departure_iata,
              arrival_iata: fn.arrival_iata,
              std_utc: localToUtc(cur, fn.std, depTz),
              sta_utc: localToUtc(arrDate, fn.sta, arrTz),
              std_local: fn.std,
              sta_local: fn.sta,
              block_minutes: fn.block_minutes,
              aircraft_type_id: fn.aircraft_type_id || null,
              service_type: fn.service_type,
              status: 'scheduled',
              arrival_day_offset: fn.arrival_day_offset,
            })
          }
        }
      }

      cur = addDays(cur, 1)
    }
  }

  if (records.length === 0) return { created: 0, skipped, errors: 0 }

  // 5. Batch insert (500 per batch to stay within Supabase limits)
  let created = 0
  let errorCount = 0

  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500)
    const { error } = await supabase.from('flights').insert(batch)
    if (error) {
      console.error('Batch insert error:', error)
      errorCount += batch.length
    } else {
      created += batch.length
    }
  }

  revalidatePath('/operations')
  return { created, skipped, errors: errorCount }
}

/** Get flights for a date range (used by operations views) */
export async function getFlightsForDateRange(
  startDate: string,
  endDate: string
): Promise<Flight[]> {
  const supabase = await createClient()
  const operatorId = await getCurrentOperatorId()
  const { data, error } = await supabase
    .from('flights')
    .select('*')
    .eq('operator_id', operatorId)
    .gte('flight_date', startDate)
    .lte('flight_date', endDate)
    .order('flight_date', { ascending: true })
    .order('flight_number', { ascending: true })

  if (error) { console.error('Error fetching flights:', error); return [] }
  return (data as Flight[]) || []
}
