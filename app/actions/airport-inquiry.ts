'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import * as fs from 'fs'
import * as path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'ourairports')
const AIRPORTS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv'
const RUNWAYS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv'
const FREQUENCIES_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airport-frequencies.csv'

// ─── CSV Parser ─────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = false
      } else current += ch
    } else {
      if (ch === '"') inQuotes = true
      else if (ch === ',') { result.push(current.trim()); current = '' }
      else current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    rows.push(row)
  }
  return rows
}

// ─── Fetch with local cache ─────────────────────────────────────────────

async function getCSV(url: string, filename: string): Promise<string> {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })
  const cachePath = path.join(CACHE_DIR, filename)

  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath)
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
    if (ageHours < 24) return fs.readFileSync(cachePath, 'utf-8')
  }

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  fs.writeFileSync(cachePath, text)
  return text
}

// ─── Surface + Frequency mapping ────────────────────────────────────────

const SURFACE_MAP: Record<string, string> = {
  'ASP': 'Asphalt', 'ASPH': 'Asphalt', 'ASPHALT': 'Asphalt',
  'CON': 'Concrete', 'CONC': 'Concrete', 'CONCRETE': 'Concrete',
  'GRS': 'Grass', 'GRASS': 'Grass', 'GRE': 'Gravel', 'GRAVEL': 'Gravel',
  'TURF': 'Turf', 'DIRT': 'Dirt', 'SAND': 'Sand', 'WAT': 'Water',
}

function mapSurface(raw: string): string {
  if (!raw) return 'Unknown'
  const u = raw.toUpperCase().trim()
  for (const [k, v] of Object.entries(SURFACE_MAP)) { if (u.includes(k)) return v }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

const FREQ_MAP: Record<string, string> = {
  'TWR': 'Tower', 'GND': 'Ground', 'APP': 'Approach', 'DEP': 'Departure',
  'ATIS': 'ATIS', 'EMERG': 'Emergency', 'CTR': 'Center', 'CLD': 'Clearance',
  'CLNC': 'Clearance', 'UNICOM': 'UNICOM',
}

function mapFreqType(raw: string): string {
  const u = raw.toUpperCase().trim()
  for (const [k, v] of Object.entries(FREQ_MAP)) { if (u.includes(k)) return v }
  return 'Other'
}

// ─── Public types ───────────────────────────────────────────────────────

export interface InquiryRunway {
  identifier: string
  length_m: number | null
  width_m: number | null
  surface: string | null
  lighting: boolean
  status: string
}

export interface InquiryFrequency {
  type: string
  frequency: string
  notes: string | null
}

export interface InquiryBasicInfo {
  latitude: number | null
  longitude: number | null
  elevation_ft: number | null
  name: string | null
  icao_code: string | null
  iata_code: string | null
  city: string | null
  iso_country: string | null
  type: string | null
}

export interface InquiryResult {
  basicInfo: InquiryBasicInfo | null
  runways: InquiryRunway[]
  frequencies: InquiryFrequency[]
  found: boolean
  error?: string
}

// ─── Lightweight IATA → basic info lookup (no runways/freqs) ────────────

export async function lookupAirportByIATA(iata: string): Promise<InquiryBasicInfo | null> {
  try {
    const upper = iata.toUpperCase().trim()
    if (upper.length !== 3) return null
    const csv = await getCSV(AIRPORTS_URL, 'airports.csv')
    const lines = csv.split('\n')
    const headers = parseCSVLine(lines[0])
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line || !line.includes(upper)) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      if (row.iata_code === upper) {
        const lat = parseFloat(row.latitude_deg)
        const lon = parseFloat(row.longitude_deg)
        const elev = row.elevation_ft ? parseInt(row.elevation_ft) : null
        return {
          latitude: !isNaN(lat) ? lat : null,
          longitude: !isNaN(lon) ? lon : null,
          elevation_ft: elev && !isNaN(elev) ? elev : null,
          name: row.name || null,
          icao_code: row.ident || null,
          iata_code: row.iata_code || null,
          city: row.municipality || null,
          iso_country: row.iso_country || null,
          type: row.type || null,
        }
      }
    }
    return null
  } catch {
    return null
  }
}

// ─── Inquiry action ─────────────────────────────────────────────────────

export async function inquireAirport(code: string): Promise<InquiryResult> {
  const empty: InquiryResult = { basicInfo: null, runways: [], frequencies: [], found: false }

  try {
    if (!code) return { ...empty, error: 'No code provided' }
    const upperCode = code.toUpperCase().trim()
    const isIata = upperCode.length === 3
    const isIcao = upperCode.length === 4

    const [airportsCsv, runwaysCsv, freqsCsv] = await Promise.all([
      getCSV(AIRPORTS_URL, 'airports.csv'),
      getCSV(RUNWAYS_URL, 'runways.csv'),
      getCSV(FREQUENCIES_URL, 'airport-frequencies.csv'),
    ])

    // Find airport — search by ICAO (ident) or IATA (iata_code)
    const airportLines = airportsCsv.split('\n')
    const headers = parseCSVLine(airportLines[0])
    let airportRow: Record<string, string> | null = null

    for (let i = 1; i < airportLines.length; i++) {
      const line = airportLines[i].trim()
      if (!line) continue
      if (!line.includes(upperCode)) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      if (isIcao && row.ident === upperCode) { airportRow = row; break }
      if (isIata && row.iata_code === upperCode) { airportRow = row; break }
    }

    if (!airportRow) return { ...empty, error: `No data found for ${upperCode} in OurAirports database.` }

    const icaoCode = airportRow.ident || ''
    const lat = parseFloat(airportRow.latitude_deg)
    const lon = parseFloat(airportRow.longitude_deg)
    const elev = airportRow.elevation_ft ? parseInt(airportRow.elevation_ft) : null

    // Parse municipality (city) from name if needed
    const municipality = airportRow.municipality || null

    const basicInfo: InquiryBasicInfo = {
      latitude: !isNaN(lat) ? lat : null,
      longitude: !isNaN(lon) ? lon : null,
      elevation_ft: elev && !isNaN(elev) ? elev : null,
      name: airportRow.name || null,
      icao_code: icaoCode || null,
      iata_code: airportRow.iata_code || null,
      city: municipality,
      iso_country: airportRow.iso_country || null,
      type: airportRow.type || null,
    }

    // Find runways
    const runwayLines = runwaysCsv.split('\n')
    const rwyHeaders = parseCSVLine(runwayLines[0])
    const runways: InquiryResult['runways'] = []

    for (let i = 1; i < runwayLines.length; i++) {
      const line = runwayLines[i].trim()
      if (!line || !line.includes(icaoCode)) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      rwyHeaders.forEach((h, idx) => { row[h] = values[idx] || '' })
      if (row.airport_ident !== icaoCode) continue

      const leIdent = row.le_ident || ''
      const heIdent = row.he_ident || ''
      if (!leIdent && !heIdent) continue

      const lengthFt = row.length_ft ? parseInt(row.length_ft) : null
      const widthFt = row.width_ft ? parseInt(row.width_ft) : null

      runways.push({
        identifier: leIdent && heIdent ? `${leIdent}/${heIdent}` : (leIdent || heIdent),
        length_m: lengthFt && !isNaN(lengthFt) ? Math.round(lengthFt / 3.281) : null,
        width_m: widthFt && !isNaN(widthFt) ? Math.round(widthFt / 3.281) : null,
        surface: row.surface ? mapSurface(row.surface) : null,
        lighting: row.lighted === '1',
        status: row.closed === '1' ? 'closed' : 'active',
      })
    }

    // Find frequencies
    const freqLines = freqsCsv.split('\n')
    const freqHeaders = parseCSVLine(freqLines[0])
    const frequencies: InquiryResult['frequencies'] = []

    for (let i = 1; i < freqLines.length; i++) {
      const line = freqLines[i].trim()
      if (!line || !line.includes(icaoCode)) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      freqHeaders.forEach((h, idx) => { row[h] = values[idx] || '' })
      if (row.airport_ident !== icaoCode) continue
      if (!row.frequency_mhz) continue

      frequencies.push({
        type: mapFreqType(row.type),
        frequency: parseFloat(row.frequency_mhz).toFixed(3),
        notes: row.description || null,
      })
    }

    return { basicInfo, runways, frequencies, found: true }
  } catch (err) {
    console.error('Inquiry error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('Failed to fetch')) {
      return { ...empty, error: 'Could not load data source. Check network connection.' }
    }
    return { ...empty, error: msg }
  }
}

// ─── Apply inquiry data ─────────────────────────────────────────────────

export async function applyInquiryData(
  airportId: string,
  data: {
    basicFields?: { latitude?: number | null; longitude?: number | null; elevation_ft?: number | null }
    runways?: InquiryRunway[]
    frequencies?: InquiryFrequency[]
  }
) {
  const supabase = createAdminClient()
  const results = { fieldsUpdated: 0, runwaysImported: 0, frequenciesImported: 0 }

  // Apply basic info fields
  if (data.basicFields) {
    const updates: Record<string, number | null> = {}
    if (data.basicFields.latitude !== undefined && data.basicFields.latitude !== null) {
      updates.latitude = data.basicFields.latitude
      results.fieldsUpdated++
    }
    if (data.basicFields.longitude !== undefined && data.basicFields.longitude !== null) {
      updates.longitude = data.basicFields.longitude
      results.fieldsUpdated++
    }
    if (data.basicFields.elevation_ft !== undefined && data.basicFields.elevation_ft !== null) {
      updates.elevation_ft = data.basicFields.elevation_ft
      results.fieldsUpdated++
    }
    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('airports').update(updates).eq('id', airportId)
      if (error) return { error: error.message }
    }
  }

  // Apply runways
  if (data.runways && data.runways.length > 0) {
    const inserts = data.runways.map((r) => ({ airport_id: airportId, ...r }))
    const { error } = await supabase.from('airport_runways').insert(inserts)
    if (error) return { error: error.message }
    results.runwaysImported = inserts.length
  }

  // Apply frequencies
  if (data.frequencies && data.frequencies.length > 0) {
    const inserts = data.frequencies.map((f) => ({ airport_id: airportId, ...f }))
    const { error } = await supabase.from('airport_frequencies').insert(inserts)
    if (error) return { error: error.message }
    results.frequenciesImported = inserts.length
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true, results }
}

// ─── Import new airport from inquiry data ────────────────────────────────

const WEATHER_TYPES = [
  { limitation_type: 'ceiling', unit: 'ft' },
  { limitation_type: 'rvr', unit: 'm' },
  { limitation_type: 'visibility', unit: 'm' },
  { limitation_type: 'crosswind', unit: 'kt' },
  { limitation_type: 'wind', unit: 'kt' },
  { limitation_type: 'takeoff_minimum', unit: 'm' },
  { limitation_type: 'tailwind', unit: 'kt' },
]

export async function importNewAirport(data: {
  basicInfo: InquiryBasicInfo
  runways: InquiryRunway[]
  frequencies: InquiryFrequency[]
}) {
  const supabase = createAdminClient()
  const info = data.basicInfo

  if (!info.icao_code) return { error: 'ICAO code is required' }

  // Check if airport already exists
  const { data: existing } = await supabase
    .from('airports')
    .select('id')
    .eq('icao_code', info.icao_code)
    .maybeSingle()
  if (existing) return { error: `Airport ${info.icao_code} already exists in your database.` }

  // Find matching country by iso_code_2
  let countryId: string | null = null
  let countryName: string = info.iso_country || 'Unknown'
  let timezoneZoneId: string | null = null
  let timezoneIana: string = 'UTC'

  if (info.iso_country) {
    const { data: country } = await supabase
      .from('countries')
      .select('id, name')
      .eq('iso_code_2', info.iso_country)
      .maybeSingle()
    if (country) {
      countryId = country.id
      countryName = country.name
      // Get first timezone zone for this country
      const { data: tz } = await supabase
        .from('timezone_zones')
        .select('id, iana_timezone')
        .eq('country_id', country.id)
        .limit(1)
        .maybeSingle()
      if (tz) {
        timezoneZoneId = tz.id
        timezoneIana = tz.iana_timezone
      }
    }
  }

  // Create airport
  const { data: newAirport, error: aptErr } = await supabase
    .from('airports')
    .insert({
      icao_code: info.icao_code,
      iata_code: info.iata_code || null,
      name: info.name || info.icao_code,
      city: info.city || info.name || info.icao_code,
      country: countryName,
      country_id: countryId,
      timezone: timezoneIana,
      timezone_zone_id: timezoneZoneId,
      latitude: info.latitude,
      longitude: info.longitude,
      elevation_ft: info.elevation_ft,
    })
    .select('id')
    .single()
  if (aptErr) return { error: aptErr.message }

  const airportId = newAirport.id
  const results = { runways: 0, frequencies: 0, weatherTemplates: 0 }

  // Insert runways
  if (data.runways.length > 0) {
    const inserts = data.runways.map((r) => ({ airport_id: airportId, ...r }))
    const { error } = await supabase.from('airport_runways').insert(inserts)
    if (!error) results.runways = inserts.length
  }

  // Insert frequencies
  if (data.frequencies.length > 0) {
    const inserts = data.frequencies.map((f) => ({ airport_id: airportId, ...f }))
    const { error } = await supabase.from('airport_frequencies').insert(inserts)
    if (!error) results.frequencies = inserts.length
  }

  // Create weather limitation templates
  const weatherInserts = WEATHER_TYPES.map((w) => ({
    airport_id: airportId,
    limitation_type: w.limitation_type,
    unit: w.unit,
    warning_value: null,
    alert_value: null,
  }))
  const { error: wErr } = await supabase.from('airport_weather_limits').insert(weatherInserts)
  if (!wErr) results.weatherTemplates = weatherInserts.length

  revalidatePath('/admin/master-database/airports')
  return { success: true, airportId, results }
}
