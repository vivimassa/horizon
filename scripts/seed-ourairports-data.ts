/**
 * Seed airport data from OurAirports.com free datasets.
 * Fetches airports.csv, runways.csv, airport-frequencies.csv
 * and upserts into our Supabase database.
 *
 * Usage: npx tsx scripts/seed-ourairports-data.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

// ─── CSV URLs ────────────────────────────────────────────────────────────
const AIRPORTS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv'
const RUNWAYS_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv'
const FREQUENCIES_URL = 'https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airport-frequencies.csv'

const CACHE_DIR = path.join(process.cwd(), 'public', 'data', 'ourairports')

// ─── CSV Parser ─────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n')
  if (lines.length < 2) return []

  // Parse header — handle quoted fields
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

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}

// ─── Fetch with cache ───────────────────────────────────────────────────

async function fetchCSV(url: string, filename: string): Promise<string> {
  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
  }

  const cachePath = path.join(CACHE_DIR, filename)

  // Check if cache exists and is less than 24 hours old
  if (fs.existsSync(cachePath)) {
    const stat = fs.statSync(cachePath)
    const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60)
    if (ageHours < 24) {
      console.log(`  Using cached ${filename} (${ageHours.toFixed(1)}h old)`)
      return fs.readFileSync(cachePath, 'utf-8')
    }
  }

  console.log(`  Downloading ${filename}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  const text = await res.text()
  fs.writeFileSync(cachePath, text)
  console.log(`  Cached ${filename} (${(text.length / 1024 / 1024).toFixed(1)} MB)`)
  return text
}

// ─── Surface mapping ────────────────────────────────────────────────────

const SURFACE_MAP: Record<string, string> = {
  'ASP': 'Asphalt', 'ASPH': 'Asphalt', 'ASPHALT': 'Asphalt',
  'CON': 'Concrete', 'CONC': 'Concrete', 'CONCRETE': 'Concrete',
  'GRS': 'Grass', 'GRASS': 'Grass',
  'GRE': 'Gravel', 'GRAVEL': 'Gravel', 'GVL': 'Gravel',
  'TURF': 'Turf', 'DIRT': 'Dirt', 'SAND': 'Sand',
  'WAT': 'Water', 'WATER': 'Water',
  'COR': 'Coral', 'ICE': 'Ice', 'SNOW': 'Snow',
  'PEM': 'Asphalt', // Partially asphalt
}

function mapSurface(raw: string): string {
  if (!raw) return 'Unknown'
  const upper = raw.toUpperCase().trim()
  // Try exact match first
  if (SURFACE_MAP[upper]) return SURFACE_MAP[upper]
  // Try partial match
  for (const [key, val] of Object.entries(SURFACE_MAP)) {
    if (upper.includes(key)) return val
  }
  // Capitalize first letter
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
}

// ─── Frequency type mapping ─────────────────────────────────────────────

const FREQ_TYPE_MAP: Record<string, string> = {
  'TWR': 'Tower', 'TOWER': 'Tower',
  'GND': 'Ground', 'GROUND': 'Ground',
  'APP': 'Approach', 'APPROACH': 'Approach',
  'DEP': 'Departure', 'DEPARTURE': 'Departure',
  'ATIS': 'ATIS', 'D-ATIS': 'ATIS',
  'EMERG': 'Emergency',
  'CTR': 'Center', 'CNTR': 'Center',
  'FSS': 'Flight Service',
  'AFIS': 'AFIS',
  'CTAF': 'CTAF',
  'UNICOM': 'UNICOM',
  'MULTICOM': 'MULTICOM',
  'RDO': 'Radio',
  'CLD': 'Clearance', 'CLNC': 'Clearance', 'CLEARANCE': 'Clearance',
}

function mapFreqType(raw: string): string {
  if (!raw) return 'Other'
  const upper = raw.toUpperCase().trim()
  for (const [key, val] of Object.entries(FREQ_TYPE_MAP)) {
    if (upper.includes(key)) return val
  }
  return 'Other'
}

// ─── Priority ICAO prefixes ─────────────────────────────────────────────

const PRIORITY_PREFIXES = [
  'VV',       // Vietnam
  'VT',       // Thailand
  'WS',       // Singapore
  'WM', 'WB', // Malaysia, Brunei
  'RP',       // Philippines
  'WA', 'WI', 'WR', // Indonesia
  'VD',       // Cambodia
  'VY',       // Myanmar
  'VL',       // Laos
  'VA', 'VE', 'VI', 'VO', // India
  'Y',        // Australia
  'RK',       // South Korea
  'RJ',       // Japan
  'VH',       // Hong Kong
  'RC',       // Taiwan
  'Z',        // China
]

function isPriority(icao: string): boolean {
  return PRIORITY_PREFIXES.some((p) => icao.startsWith(p))
}

// ─── MAIN ───────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('  OurAirports Data Seeder')
  console.log('═══════════════════════════════════════════════════════════════')

  // Step 1: Fetch CSVs
  console.log('\n1. Fetching CSV data...')
  const [airportsCsv, runwaysCsv, freqsCsv] = await Promise.all([
    fetchCSV(AIRPORTS_URL, 'airports.csv'),
    fetchCSV(RUNWAYS_URL, 'runways.csv'),
    fetchCSV(FREQUENCIES_URL, 'airport-frequencies.csv'),
  ])

  console.log('\n2. Parsing CSVs...')
  const oaAirports = parseCSV(airportsCsv)
  const oaRunways = parseCSV(runwaysCsv)
  const oaFreqs = parseCSV(freqsCsv)
  console.log(`  Airports: ${oaAirports.length} rows`)
  console.log(`  Runways: ${oaRunways.length} rows`)
  console.log(`  Frequencies: ${oaFreqs.length} rows`)

  // Build lookup maps
  const oaAirportMap = new Map<string, typeof oaAirports[0]>()
  for (const a of oaAirports) {
    if (a.ident) oaAirportMap.set(a.ident, a)
  }

  const oaRunwaysByAirport = new Map<string, typeof oaRunways>()
  for (const r of oaRunways) {
    const ident = r.airport_ident
    if (!ident) continue
    if (!oaRunwaysByAirport.has(ident)) oaRunwaysByAirport.set(ident, [])
    oaRunwaysByAirport.get(ident)!.push(r)
  }

  const oaFreqsByAirport = new Map<string, typeof oaFreqs>()
  for (const f of oaFreqs) {
    const ident = f.airport_ident
    if (!ident) continue
    if (!oaFreqsByAirport.has(ident)) oaFreqsByAirport.set(ident, [])
    oaFreqsByAirport.get(ident)!.push(f)
  }

  // Step 2: Get our airports
  console.log('\n3. Fetching our airports from database...')
  const { data: ourAirports, error: fetchErr } = await supabase
    .from('airports')
    .select('id, icao_code, iata_code, latitude, longitude, elevation_ft, name')
  if (fetchErr) throw new Error(`Failed to fetch airports: ${fetchErr.message}`)
  console.log(`  Our airports: ${ourAirports!.length}`)

  const ourAirportMap = new Map<string, typeof ourAirports![0]>()
  for (const a of ourAirports!) {
    ourAirportMap.set(a.icao_code, a)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Step 3: Update existing airports with OurAirports basic info
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n4. Updating existing airports with OurAirports data...')
  let updatedCount = 0
  let skippedCount = 0

  for (const [icao, our] of ourAirportMap) {
    const oa = oaAirportMap.get(icao)
    if (!oa) { skippedCount++; continue }

    const updates: Record<string, number | string | null> = {}
    const priority = isPriority(icao)

    // For priority airports: fill if null. For others: fill if null only
    const lat = parseFloat(oa.latitude_deg)
    const lon = parseFloat(oa.longitude_deg)
    const elev = oa.elevation_ft ? parseInt(oa.elevation_ft) : null

    if (!isNaN(lat) && (our.latitude === null || priority)) {
      updates.latitude = lat
    }
    if (!isNaN(lon) && (our.longitude === null || priority)) {
      updates.longitude = lon
    }
    if (elev !== null && !isNaN(elev) && (our.elevation_ft === null || priority)) {
      updates.elevation_ft = elev
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('airports').update(updates).eq('id', our.id)
      if (error) console.error(`  Error updating ${icao}:`, error.message)
      else updatedCount++
    }
  }
  console.log(`  Updated: ${updatedCount}, No OA match: ${skippedCount}`)

  // ═══════════════════════════════════════════════════════════════════════
  // Step 4: Seed Runways
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n5. Seeding runways...')

  // First get existing runways to avoid duplicates
  const { data: existingRunways } = await supabase
    .from('airport_runways')
    .select('airport_id, identifier')
  const existingRunwayKeys = new Set<string>()
  for (const r of existingRunways || []) {
    existingRunwayKeys.add(`${r.airport_id}::${r.identifier}`)
  }

  let runwaysSeeded = 0
  let runwaysSkipped = 0
  const runwayBatch: {
    airport_id: string
    identifier: string
    length_m: number | null
    width_m: number | null
    surface: string | null
    lighting: boolean
    status: string
  }[] = []

  for (const [icao, our] of ourAirportMap) {
    const rwys = oaRunwaysByAirport.get(icao)
    if (!rwys) continue

    for (const rwy of rwys) {
      const leIdent = rwy.le_ident || ''
      const heIdent = rwy.he_ident || ''
      if (!leIdent && !heIdent) continue

      const identifier = leIdent && heIdent ? `${leIdent}/${heIdent}` : (leIdent || heIdent)
      const key = `${our.id}::${identifier}`

      if (existingRunwayKeys.has(key)) { runwaysSkipped++; continue }

      const lengthFt = rwy.length_ft ? parseInt(rwy.length_ft) : null
      const widthFt = rwy.width_ft ? parseInt(rwy.width_ft) : null

      runwayBatch.push({
        airport_id: our.id,
        identifier,
        length_m: lengthFt && !isNaN(lengthFt) ? Math.round(lengthFt / 3.281) : null,
        width_m: widthFt && !isNaN(widthFt) ? Math.round(widthFt / 3.281) : null,
        surface: rwy.surface ? mapSurface(rwy.surface) : null,
        lighting: rwy.lighted === '1',
        status: rwy.closed === '1' ? 'closed' : 'active',
      })
      existingRunwayKeys.add(key)
    }
  }

  // Insert in batches
  for (let i = 0; i < runwayBatch.length; i += 100) {
    const batch = runwayBatch.slice(i, i + 100)
    const { error } = await supabase.from('airport_runways').insert(batch)
    if (error) console.error(`  Runway batch error:`, error.message)
    else runwaysSeeded += batch.length
  }
  console.log(`  Seeded: ${runwaysSeeded}, Skipped (existing): ${runwaysSkipped}`)

  // ═══════════════════════════════════════════════════════════════════════
  // Step 5: Seed Frequencies
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n6. Seeding frequencies...')

  const { data: existingFreqs } = await supabase
    .from('airport_frequencies')
    .select('airport_id, type, frequency')
  const existingFreqKeys = new Set<string>()
  for (const f of existingFreqs || []) {
    existingFreqKeys.add(`${f.airport_id}::${f.type}::${f.frequency}`)
  }

  let freqsSeeded = 0
  let freqsSkipped = 0
  const freqBatch: {
    airport_id: string
    type: string
    frequency: string
    notes: string | null
  }[] = []

  for (const [icao, our] of ourAirportMap) {
    const freqs = oaFreqsByAirport.get(icao)
    if (!freqs) continue

    for (const f of freqs) {
      if (!f.frequency_mhz) continue
      const type = mapFreqType(f.type)
      const frequency = parseFloat(f.frequency_mhz).toFixed(3)
      const key = `${our.id}::${type}::${frequency}`

      if (existingFreqKeys.has(key)) { freqsSkipped++; continue }

      freqBatch.push({
        airport_id: our.id,
        type,
        frequency,
        notes: f.description || null,
      })
      existingFreqKeys.add(key)
    }
  }

  for (let i = 0; i < freqBatch.length; i += 100) {
    const batch = freqBatch.slice(i, i + 100)
    const { error } = await supabase.from('airport_frequencies').insert(batch)
    if (error) console.error(`  Frequency batch error:`, error.message)
    else freqsSeeded += batch.length
  }
  console.log(`  Seeded: ${freqsSeeded}, Skipped (existing): ${freqsSkipped}`)

  // ═══════════════════════════════════════════════════════════════════════
  // Step 6: Seed Weather Limitation Templates
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n7. Seeding weather limitation templates...')

  const { data: existingWeather } = await supabase
    .from('airport_weather_limits')
    .select('airport_id, limitation_type')
  const existingWeatherKeys = new Set<string>()
  for (const w of existingWeather || []) {
    existingWeatherKeys.add(`${w.airport_id}::${w.limitation_type}`)
  }

  const WEATHER_TYPES = [
    { limitation_type: 'ceiling', unit: 'ft' },
    { limitation_type: 'rvr', unit: 'm' },
    { limitation_type: 'visibility', unit: 'm' },
    { limitation_type: 'crosswind', unit: 'kt' },
    { limitation_type: 'wind', unit: 'kt' },
    { limitation_type: 'takeoff_minimum', unit: 'm' },
    { limitation_type: 'tailwind', unit: 'kt' },
  ]

  let weatherSeeded = 0
  const weatherBatch: {
    airport_id: string
    limitation_type: string
    unit: string
    warning_value: null
    alert_value: null
  }[] = []

  for (const apt of ourAirports!) {
    for (const wt of WEATHER_TYPES) {
      const key = `${apt.id}::${wt.limitation_type}`
      if (existingWeatherKeys.has(key)) continue

      weatherBatch.push({
        airport_id: apt.id,
        limitation_type: wt.limitation_type,
        unit: wt.unit,
        warning_value: null,
        alert_value: null,
      })
    }
  }

  for (let i = 0; i < weatherBatch.length; i += 200) {
    const batch = weatherBatch.slice(i, i + 200)
    const { error } = await supabase.from('airport_weather_limits').insert(batch)
    if (error) console.error(`  Weather batch error:`, error.message)
    else weatherSeeded += batch.length
  }
  console.log(`  Seeded: ${weatherSeeded} weather limit templates`)

  // ═══════════════════════════════════════════════════════════════════════
  // Step 7: Seed TAT Rules for key airports
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n8. Seeding TAT rules for key airports...')

  // Get aircraft types
  const { data: acTypes } = await supabase
    .from('aircraft_types')
    .select('id, icao_type')
    .eq('is_active', true)

  const acTypeMap = new Map<string, string>()
  for (const t of acTypes || []) {
    acTypeMap.set(t.icao_type, t.id)
  }

  // Get existing TAT rules
  const { data: existingTat } = await supabase
    .from('airport_tat_rules')
    .select('airport_id, aircraft_type_id')
  const existingTatKeys = new Set<string>()
  for (const t of existingTat || []) {
    existingTatKeys.add(`${t.airport_id}::${t.aircraft_type_id}`)
  }

  // IATA-to-airport-id lookup
  const iataToId = new Map<string, string>()
  for (const apt of ourAirports!) {
    if (apt.iata_code) iataToId.set(apt.iata_code, apt.id)
  }

  interface TATSeed {
    iata: string
    acType: string
    commercial: number
    domDom: number
    domInt: number
    intDom: number
    intInt: number
  }

  const tatSeeds: TATSeed[] = [
    // SGN
    { iata: 'SGN', acType: 'A320', commercial: 45, domDom: 35, domInt: 50, intDom: 50, intInt: 45 },
    { iata: 'SGN', acType: 'A321', commercial: 45, domDom: 35, domInt: 50, intDom: 50, intInt: 45 },
    { iata: 'SGN', acType: 'A333', commercial: 75, domDom: 60, domInt: 80, intDom: 80, intInt: 75 },
    // HAN
    { iata: 'HAN', acType: 'A320', commercial: 40, domDom: 30, domInt: 45, intDom: 45, intInt: 40 },
    { iata: 'HAN', acType: 'A321', commercial: 40, domDom: 30, domInt: 45, intDom: 45, intInt: 40 },
    { iata: 'HAN', acType: 'A333', commercial: 70, domDom: 55, domInt: 75, intDom: 75, intInt: 70 },
    // DAD
    { iata: 'DAD', acType: 'A320', commercial: 35, domDom: 30, domInt: 40, intDom: 40, intInt: 35 },
    { iata: 'DAD', acType: 'A321', commercial: 35, domDom: 30, domInt: 40, intDom: 40, intInt: 35 },
    // CXR
    { iata: 'CXR', acType: 'A320', commercial: 35, domDom: 30, domInt: 40, intDom: 40, intInt: 35 },
    // BKK
    { iata: 'BKK', acType: 'A320', commercial: 45, domDom: 35, domInt: 50, intDom: 50, intInt: 45 },
    { iata: 'BKK', acType: 'A333', commercial: 75, domDom: 60, domInt: 80, intDom: 80, intInt: 75 },
    // SIN
    { iata: 'SIN', acType: 'A320', commercial: 40, domDom: 35, domInt: 45, intDom: 45, intInt: 40 },
    { iata: 'SIN', acType: 'A333', commercial: 60, domDom: 50, domInt: 65, intDom: 65, intInt: 60 },
  ]

  let tatSeeded = 0
  let tatSkipped = 0

  for (const seed of tatSeeds) {
    const airportId = iataToId.get(seed.iata)
    const acTypeId = acTypeMap.get(seed.acType)

    if (!airportId) { console.log(`  TAT skip: airport ${seed.iata} not found`); tatSkipped++; continue }
    if (!acTypeId) { console.log(`  TAT skip: aircraft type ${seed.acType} not found`); tatSkipped++; continue }

    const key = `${airportId}::${acTypeId}`
    if (existingTatKeys.has(key)) { tatSkipped++; continue }

    const { error } = await supabase.from('airport_tat_rules').insert({
      airport_id: airportId,
      aircraft_type_id: acTypeId,
      tat_minutes: seed.commercial,
      tat_dom_dom_minutes: seed.domDom,
      tat_dom_int_minutes: seed.domInt,
      tat_int_dom_minutes: seed.intDom,
      tat_int_int_minutes: seed.intInt,
    })

    if (error) console.error(`  TAT error ${seed.iata}/${seed.acType}:`, error.message)
    else tatSeeded++
  }
  console.log(`  Seeded: ${tatSeeded}, Skipped: ${tatSkipped}`)

  // ═══════════════════════════════════════════════════════════════════════
  // REPORT
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log('  RESULTS')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log(`  Airports updated with basic info:  ${updatedCount}`)
  console.log(`  Runways seeded:                    ${runwaysSeeded}`)
  console.log(`  Frequencies seeded:                ${freqsSeeded}`)
  console.log(`  Weather limit templates created:   ${weatherSeeded}`)
  console.log(`  TAT rules seeded:                  ${tatSeeded}`)
  console.log(`  Airports without OA match:         ${skippedCount}`)
  console.log('═══════════════════════════════════════════════════════════════')
}

main().catch(console.error)
