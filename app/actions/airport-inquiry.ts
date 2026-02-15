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

export interface InquiryResult {
  basicInfo: {
    latitude: number | null
    longitude: number | null
    elevation_ft: number | null
    name: string | null
  } | null
  runways: {
    identifier: string
    length_m: number | null
    width_m: number | null
    surface: string | null
    lighting: boolean
    status: string
  }[]
  frequencies: {
    type: string
    frequency: string
    notes: string | null
  }[]
  found: boolean
}

// ─── Inquiry action ─────────────────────────────────────────────────────

export async function inquireAirport(icaoCode: string): Promise<InquiryResult> {
  const empty: InquiryResult = { basicInfo: null, runways: [], frequencies: [], found: false }

  try {
    const [airportsCsv, runwaysCsv, freqsCsv] = await Promise.all([
      getCSV(AIRPORTS_URL, 'airports.csv'),
      getCSV(RUNWAYS_URL, 'runways.csv'),
      getCSV(FREQUENCIES_URL, 'airport-frequencies.csv'),
    ])

    // Find airport
    const airportLines = airportsCsv.split('\n')
    const headers = parseCSVLine(airportLines[0])
    let airportRow: Record<string, string> | null = null

    for (let i = 1; i < airportLines.length; i++) {
      const line = airportLines[i].trim()
      if (!line) continue
      // Quick check before full parse
      if (!line.includes(icaoCode)) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      if (row.ident === icaoCode) { airportRow = row; break }
    }

    if (!airportRow) return empty

    const lat = parseFloat(airportRow.latitude_deg)
    const lon = parseFloat(airportRow.longitude_deg)
    const elev = airportRow.elevation_ft ? parseInt(airportRow.elevation_ft) : null

    const basicInfo = {
      latitude: !isNaN(lat) ? lat : null,
      longitude: !isNaN(lon) ? lon : null,
      elevation_ft: elev && !isNaN(elev) ? elev : null,
      name: airportRow.name || null,
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
    return empty
  }
}

// ─── Apply inquiry data ─────────────────────────────────────────────────

export async function applyInquiryData(
  airportId: string,
  data: {
    applyBasic: boolean
    basicInfo?: { latitude: number | null; longitude: number | null; elevation_ft: number | null }
    applyRunways: boolean
    runways?: InquiryResult['runways']
    applyFrequencies: boolean
    frequencies?: InquiryResult['frequencies']
  }
) {
  const supabase = createAdminClient()
  const results = { basic: false, runways: 0, frequencies: 0 }

  // Apply basic info
  if (data.applyBasic && data.basicInfo) {
    const updates: Record<string, number | null> = {}
    if (data.basicInfo.latitude !== null) updates.latitude = data.basicInfo.latitude
    if (data.basicInfo.longitude !== null) updates.longitude = data.basicInfo.longitude
    if (data.basicInfo.elevation_ft !== null) updates.elevation_ft = data.basicInfo.elevation_ft

    if (Object.keys(updates).length > 0) {
      const { error } = await supabase.from('airports').update(updates).eq('id', airportId)
      if (error) return { error: error.message }
      results.basic = true
    }
  }

  // Apply runways
  if (data.applyRunways && data.runways && data.runways.length > 0) {
    // Get existing
    const { data: existing } = await supabase
      .from('airport_runways')
      .select('identifier')
      .eq('airport_id', airportId)
    const existingIds = new Set((existing || []).map((r) => r.identifier))

    const newRunways = data.runways
      .filter((r) => !existingIds.has(r.identifier))
      .map((r) => ({ airport_id: airportId, ...r }))

    if (newRunways.length > 0) {
      const { error } = await supabase.from('airport_runways').insert(newRunways)
      if (error) return { error: error.message }
      results.runways = newRunways.length
    }
  }

  // Apply frequencies
  if (data.applyFrequencies && data.frequencies && data.frequencies.length > 0) {
    const { data: existing } = await supabase
      .from('airport_frequencies')
      .select('type, frequency')
      .eq('airport_id', airportId)
    const existingKeys = new Set((existing || []).map((f) => `${f.type}::${f.frequency}`))

    const newFreqs = data.frequencies
      .filter((f) => !existingKeys.has(`${f.type}::${f.frequency}`))
      .map((f) => ({ airport_id: airportId, ...f }))

    if (newFreqs.length > 0) {
      const { error } = await supabase.from('airport_frequencies').insert(newFreqs)
      if (error) return { error: error.message }
      results.frequencies = newFreqs.length
    }
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true, results }
}
