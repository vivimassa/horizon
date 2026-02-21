/**
 * SSIM Chapter 7 Parser Engine
 *
 * Parses standard IATA SSIM (Standard Schedules Information Manual) Chapter 7
 * fixed-width text files. Column positions verified against real Vietjet SSIM data.
 *
 * All column references are 0-indexed.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface SSIMHeader {
  recordType: 1
  title: string
}

export interface SSIMCarrier {
  recordType: 2
  actionCode: string
  airlineCode: string
  seasonStart: string   // ISO date YYYY-MM-DD
  seasonEnd: string     // ISO date YYYY-MM-DD
  creationDate: string  // ISO date YYYY-MM-DD
  airlineName: string
  releaseCode: string
  creator: string
}

export interface SSIMFlightLeg {
  recordType: 3
  suffix: string
  airlineCode: string
  flightNumber: number
  itineraryVariation: string
  legSequence: string
  serviceType: string
  periodStart: string   // ISO date YYYY-MM-DD
  periodEnd: string     // ISO date YYYY-MM-DD
  daysOfOperation: string  // "1234567" format with spaces for non-operating days
  depStation: string
  stdUtc: string      // HHMM
  stdPassenger: string  // HHMM
  depUtcOffset: string  // +HHMM or -HHMM
  arrStation: string
  staUtc: string      // HHMM
  staPassenger: string  // HHMM
  arrUtcOffset: string  // +HHMM or -HHMM
  aircraftType: string  // IATA 3-letter code
  seatConfig: Record<string, number>  // e.g. { C: 12, Y: 365 }
  totalCapacity: number
  blockMinutes: number
  recordNumber: number
  rawLine: string
}

export interface SSIMTrailer {
  recordType: 5
  airlineCode: string
  lastFlightSerial: number
  recordCount: number
}

export interface SSIMParseResult {
  header: SSIMHeader | null
  carrier: SSIMCarrier | null
  flights: SSIMFlightLeg[]
  trailer: SSIMTrailer | null
  stats: {
    totalRecords: number
    uniqueFlightNumbers: number
    uniqueRoutes: number
    dateRange: { start: string; end: string }
    aircraftTypes: string[]
    serviceTypes: Record<string, number>
    stations: string[]
    domesticRoutes: number
    internationalRoutes: number
    aircraftTypeCounts: Record<string, number>
  }
  errors: { line: number; message: string }[]
}

// ─── Constants ─────────────────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const

/** Vietnam IATA airport codes — used for domestic/international classification */
const VN_AIRPORTS = new Set([
  'SGN', 'HAN', 'DAD', 'CXR', 'PQC', 'HPH', 'VII', 'HUI', 'VDO', 'VCA',
  'UIH', 'TBB', 'BMV', 'DLI', 'VCL', 'VDH', 'THD', 'DIN', 'PXU', 'VCS',
  'CAH', 'SQH', 'VKG', 'CON', 'PHA',
])

// ─── Date Parsing ──────────────────────────────────────────────────

/** Parse SSIM date "DDMMMYY" → ISO "YYYY-MM-DD" */
function parseSsimDate(s: string): string {
  if (!s || s.trim().length < 7) return ''
  const dd = s.slice(0, 2)
  const mmm = s.slice(2, 5).toUpperCase()
  const yy = s.slice(5, 7)
  const monthIdx = MONTHS.indexOf(mmm as typeof MONTHS[number])
  if (monthIdx < 0) return ''
  const yyNum = parseInt(yy, 10)
  const year = yyNum < 70 ? 2000 + yyNum : 1900 + yyNum
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${dd}`
}

// ─── Seat Config Parsing ───────────────────────────────────────────

/** Parse seat config like "C12Y365" → { C: 12, Y: 365 } */
function parseSeatConfig(raw: string): { config: Record<string, number>; total: number } {
  const config: Record<string, number> = {}
  let total = 0
  const regex = /([A-Z])(\d{1,3})/g
  let match
  while ((match = regex.exec(raw)) !== null) {
    const cabin = match[1]
    const seats = parseInt(match[2], 10)
    config[cabin] = seats
    total += seats
  }
  return { config, total }
}

// ─── Block Time Calculation ────────────────────────────────────────

/**
 * Calculate block time in minutes from SSIM STD/STA.
 * SSIM positions 39-42 (STD) and 57-60 (STA) are already in UTC.
 * The +HH:MM offset is metadata for display, not for conversion.
 */
function calcBlockMinutes(
  std: string,          // HHMM in UTC
  _depOffset: string,   // unused — kept for signature compat
  sta: string,          // HHMM in UTC
  _arrOffset: string    // unused
): number {
  if (!std || !sta || std.length < 4 || sta.length < 4) return 0

  const depMin = parseInt(std.slice(0, 2), 10) * 60 + parseInt(std.slice(2, 4), 10)
  let arrMin = parseInt(sta.slice(0, 2), 10) * 60 + parseInt(sta.slice(2, 4), 10)

  // Handle overnight: if arrival UTC < departure UTC, add 24h
  if (arrMin <= depMin) {
    arrMin += 1440
  }

  return arrMin - depMin
}

/** Parse UTC offset "+0700" → minutes (420) */
function parseUtcOffset(offset: string): number {
  if (!offset || offset.trim().length < 5) return 0
  const trimmed = offset.trim()
  const sign = trimmed[0] === '-' ? -1 : 1
  const hours = parseInt(trimmed.slice(1, 3), 10)
  const mins = parseInt(trimmed.slice(3, 5), 10)
  return sign * (hours * 60 + mins)
}

/** Convert UTC time HHMM + offset → local HHMM string */
function utcToLocal(utcTime: string, utcOffset: string): string {
  if (!utcTime || utcTime.length < 4) return ''
  const utcMin = parseInt(utcTime.slice(0, 2), 10) * 60 + parseInt(utcTime.slice(2, 4), 10)
  const offsetMin = parseUtcOffset(utcOffset)
  let localMin = utcMin + offsetMin
  if (localMin < 0) localMin += 1440
  if (localMin >= 1440) localMin -= 1440
  const h = Math.floor(localMin / 60)
  const m = localMin % 60
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
}

// ─── Main Parser ───────────────────────────────────────────────────

/**
 * Parse an SSIM Chapter 7 file.
 *
 * Verified column positions (0-indexed) for Type 3 records:
 *   0      : Record type ("3")
 *   1      : Operational suffix
 *   2-4    : Airline designator (3 chars, left-justified, e.g. "VJ ")
 *   5-8    : Flight number (4 chars, right-justified, e.g. "  31" or "8512")
 *   9-10   : Itinerary variation ("01")
 *   11-12  : Leg sequence ("01")
 *   13     : Service type ("J"=Scheduled, "C"=Charter, etc.)
 *   14-20  : Period start (DDMMMYY, e.g. "26DEC25")
 *   21-27  : Period end (DDMMMYY, e.g. "27MAR26")
 *   28-34  : Days of operation (7 chars, "1234567" where space=not operating)
 *   35     : Space
 *   36-38  : Departure station (3-letter IATA)
 *   39-42  : STD local (HHMM)
 *   43-46  : STD passenger (HHMM)
 *   47-51  : Dep UTC offset (+HHMM, 5 chars)
 *   52-53  : Spaces
 *   54-56  : Arrival station (3-letter IATA)
 *   57-60  : STA local (HHMM)
 *   61-64  : STA passenger (HHMM)
 *   65-69  : Arr UTC offset (+HHMM, 5 chars)
 *   70-71  : Spaces
 *   72-74  : Aircraft type (IATA 3-char)
 *   172-191: Seat configuration area (e.g. "C12Y365")
 *   194-199: Record serial number (6 digits)
 */
export function parseSSIM(fileContent: string): SSIMParseResult {
  const lines = fileContent.split(/\r?\n/)
  const result: SSIMParseResult = {
    header: null,
    carrier: null,
    flights: [],
    trailer: null,
    stats: {
      totalRecords: 0,
      uniqueFlightNumbers: 0,
      uniqueRoutes: 0,
      dateRange: { start: '', end: '' },
      aircraftTypes: [],
      serviceTypes: {},
      stations: [],
      domesticRoutes: 0,
      internationalRoutes: 0,
      aircraftTypeCounts: {},
    },
    errors: [],
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    // Skip empty lines and zero-padding lines
    if (!line || line.length === 0 || line[0] === '0') continue

    const recordType = line[0]

    try {
      switch (recordType) {
        case '1':
          result.header = parseType1(line)
          break

        case '2':
          result.carrier = parseType2(line)
          break

        case '3':
          if (line.length < 75) {
            result.errors.push({ line: lineNum, message: `Type 3 record too short (${line.length} chars, need ≥75)` })
            break
          }
          const flight = parseType3(line, lineNum)
          if (flight) {
            result.flights.push(flight)
          }
          break

        case '5':
          result.trailer = parseType5(line)
          break

        default:
          // Unknown record type — skip silently (could be type 4 segment data)
          break
      }
    } catch (err) {
      result.errors.push({
        line: lineNum,
        message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  // Compute stats
  computeStats(result)

  return result
}

// ─── Record Parsers ────────────────────────────────────────────────

function parseType1(line: string): SSIMHeader {
  return {
    recordType: 1,
    title: line.substring(1).trim(),
  }
}

function parseType2(line: string): SSIMCarrier {
  return {
    recordType: 2,
    actionCode: line[1] || '',
    airlineCode: line.substring(2, 5).trim(),
    seasonStart: parseSsimDate(line.substring(14, 21)),
    seasonEnd: parseSsimDate(line.substring(21, 28)),
    creationDate: parseSsimDate(line.substring(28, 35)),
    airlineName: line.substring(36, 71).trim(),
    releaseCode: (line[71] || '').trim(),
    creator: line.substring(72, 80).trim(),
  }
}

function parseType3(line: string, lineNum: number): SSIMFlightLeg | null {
  const suffix = line[1] || ''
  const airlineCode = line.substring(2, 5).trim()
  const flightNumRaw = line.substring(5, 9).trim()
  const flightNumber = parseInt(flightNumRaw, 10)

  if (isNaN(flightNumber)) {
    return null
  }

  const itineraryVariation = line.substring(9, 11)
  const legSequence = line.substring(11, 13)
  const serviceType = line[13] || 'J'
  const periodStart = parseSsimDate(line.substring(14, 21))
  const periodEnd = parseSsimDate(line.substring(21, 28))
  const daysOfOperation = line.substring(28, 35)

  const depStation = line.substring(36, 39).trim()
  const stdUtc = line.substring(39, 43).trim()
  const stdPassenger = line.substring(43, 47).trim()
  const depUtcOffset = line.substring(47, 52).trim()

  const arrStation = line.substring(54, 57).trim()
  const staUtc = line.substring(57, 61).trim()
  const staPassenger = line.substring(61, 65).trim()
  const arrUtcOffset = line.substring(65, 70).trim()

  const aircraftType = line.substring(72, 75).trim()

  // Seat config — scan area around col 172-192
  let seatConfig: Record<string, number> = {}
  let totalCapacity = 0
  if (line.length > 172) {
    const seatArea = line.substring(172, 192)
    const parsed = parseSeatConfig(seatArea)
    seatConfig = parsed.config
    totalCapacity = parsed.total
  }

  // Record serial number — last 6 digits before line end
  let recordNumber = 0
  if (line.length >= 200) {
    const serialStr = line.substring(194, 200).trim()
    recordNumber = parseInt(serialStr, 10) || 0
  }

  // Calculate block time
  const blockMinutes = calcBlockMinutes(stdUtc, depUtcOffset, staUtc, arrUtcOffset)

  return {
    recordType: 3,
    suffix,
    airlineCode,
    flightNumber,
    itineraryVariation,
    legSequence,
    serviceType,
    periodStart,
    periodEnd,
    daysOfOperation,
    depStation,
    stdUtc,
    stdPassenger,
    depUtcOffset,
    arrStation,
    staUtc,
    staPassenger,
    arrUtcOffset,
    aircraftType,
    seatConfig,
    totalCapacity,
    blockMinutes,
    recordNumber,
    rawLine: line,
  }
}

function parseType5(line: string): SSIMTrailer {
  const airlineCode = line.substring(2, 5).trim()

  // Trailer end contains: [lastFlightSerial]E[totalRecordCount]
  // e.g. "000966E000967"
  let lastFlightSerial = 0
  let recordCount = 0

  if (line.length >= 200) {
    const tail = line.substring(187, 200).trim()
    const match = tail.match(/(\d+)[A-Z](\d+)/)
    if (match) {
      lastFlightSerial = parseInt(match[1], 10)
      recordCount = parseInt(match[2], 10)
    }
  }

  return {
    recordType: 5,
    airlineCode,
    lastFlightSerial,
    recordCount,
  }
}

// ─── Stats Computation ─────────────────────────────────────────────

function computeStats(result: SSIMParseResult): void {
  const flights = result.flights
  if (flights.length === 0) return

  result.stats.totalRecords = flights.length

  // Unique flight numbers
  const flightNums = new Set(flights.map(f => `${f.airlineCode}${f.flightNumber}`))
  result.stats.uniqueFlightNumbers = flightNums.size

  // Unique routes
  const routes = new Set(flights.map(f => `${f.depStation}-${f.arrStation}`))
  result.stats.uniqueRoutes = routes.size

  // Date range
  const starts = flights.map(f => f.periodStart).filter(Boolean).sort()
  const ends = flights.map(f => f.periodEnd).filter(Boolean).sort()
  result.stats.dateRange = {
    start: starts[0] || '',
    end: ends[ends.length - 1] || '',
  }

  // Aircraft types
  const acTypes = new Map<string, number>()
  flights.forEach(f => {
    if (f.aircraftType) {
      acTypes.set(f.aircraftType, (acTypes.get(f.aircraftType) || 0) + 1)
    }
  })
  result.stats.aircraftTypes = Array.from(acTypes.keys()).sort()
  result.stats.aircraftTypeCounts = Object.fromEntries(acTypes)

  // Service types
  const svcTypes: Record<string, number> = {}
  flights.forEach(f => {
    svcTypes[f.serviceType] = (svcTypes[f.serviceType] || 0) + 1
  })
  result.stats.serviceTypes = svcTypes

  // Stations
  const stations = new Set<string>()
  flights.forEach(f => {
    stations.add(f.depStation)
    stations.add(f.arrStation)
  })
  result.stats.stations = Array.from(stations).sort()

  // Domestic vs international (based on VN airports)
  let domestic = 0
  let international = 0
  routes.forEach(route => {
    const [dep, arr] = route.split('-')
    if (VN_AIRPORTS.has(dep) && VN_AIRPORTS.has(arr)) {
      domestic++
    } else {
      international++
    }
  })
  result.stats.domesticRoutes = domestic
  result.stats.internationalRoutes = international
}

// ─── Exported Helpers ──────────────────────────────────────────────

/** Convert SSIM DOW "1 3 5  " → condensed "135" */
export function condenseDaysOfOp(ssimDays: string): string {
  let result = ''
  for (let i = 0; i < 7 && i < ssimDays.length; i++) {
    if (ssimDays[i] !== ' ') result += ssimDays[i]
  }
  return result
}

/** Expand condensed DOW "135" → SSIM "1 3 5  " */
export function expandDaysOfOp(condensed: string): string {
  let result = ''
  for (let i = 1; i <= 7; i++) {
    result += condensed.includes(String(i)) ? String(i) : ' '
  }
  return result
}

/** Format DOW "1   5  " → human-readable "Mon, Fri" */
export function formatDaysOfOp(ssimDays: string): string {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const active: string[] = []
  for (let i = 0; i < 7 && i < ssimDays.length; i++) {
    if (ssimDays[i] !== ' ') {
      active.push(dayNames[i])
    }
  }
  if (active.length === 7) return 'Daily'
  return active.join(', ')
}

/** Service type code → display label */
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  // Scheduled — Passenger
  J: 'Normal Service',
  S: 'Shuttle Mode',
  U: 'Surface Vehicle / Air Ambulance',
  // Charter — Passenger
  C: 'Charter Passenger',
  // Additional — Passenger
  B: 'Shuttle Mode (Additional)',
  G: 'Normal Service (Additional)',
  // Scheduled — Cargo/Mail
  F: 'Cargo (Loose/Preloaded)',
  M: 'Mail Only',
  V: 'Surface Vehicle (Cargo)',
  // Charter — Cargo/Mail
  H: 'Charter Cargo/Mail',
  // Additional — Cargo/Mail
  A: 'Cargo/Mail (Additional)',
  // Passenger/Cargo Mixed
  Q: 'Passenger/Cargo Mixed',
  R: 'Passenger/Cargo Mixed (Additional)',
  // Charter — Pax/Cargo/Mail
  L: 'Charter Passenger/Cargo/Mail',
  O: 'Charter Special Handling',
  // Others
  P: 'Positioning/Ferry/Delivery',
  T: 'Technical Test',
  K: 'Crew Training',
  W: 'Military',
  E: 'Special (FAA/Government)',
  D: 'General Aviation / Empty',
  N: 'Business Aviation / Air Taxi',
  I: 'State/Diplomatic',
  X: 'Technical Stop',
}

/** Service types grouped by application category */
export const SERVICE_TYPE_GROUPS: { label: string; codes: string[]; color: string }[] = [
  { label: 'Scheduled — Passenger',    codes: ['J', 'S', 'U'],                         color: '#22c55e' },
  { label: 'Charter — Passenger',      codes: ['C'],                                    color: '#3b82f6' },
  { label: 'Additional — Passenger',   codes: ['B', 'G'],                               color: '#a855f7' },
  { label: 'Scheduled — Cargo/Mail',   codes: ['F', 'M', 'V'],                          color: '#f97316' },
  { label: 'Charter — Cargo/Mail',     codes: ['H'],                                    color: '#ea580c' },
  { label: 'Additional — Cargo/Mail',  codes: ['A'],                                    color: '#c2410c' },
  { label: 'Passenger/Cargo Mixed',    codes: ['Q', 'R'],                               color: '#0ea5e9' },
  { label: 'Charter — Pax/Cargo/Mail', codes: ['L', 'O'],                               color: '#6366f1' },
  { label: 'Others',                   codes: ['P', 'T', 'K', 'W', 'E', 'D', 'N', 'I', 'X'], color: '#6b7280' },
]

/** Color for a service type code */
export function getServiceTypeColor(code: string): string {
  for (const g of SERVICE_TYPE_GROUPS) {
    if (g.codes.includes(code)) return g.color
  }
  return '#6b7280'
}

/** parseUtcOffset is used internally by calcBlockMinutes */

/** IATA → ICAO aircraft type mapping (common narrow/wide-body) */
export const IATA_TO_ICAO_AIRCRAFT: Record<string, string> = {
  '319': 'A319',
  '320': 'A320',
  '321': 'A321',
  '32Q': 'A21N',
  '32N': 'A20N',
  '32A': 'A320',
  '32B': 'A321',
  '330': 'A333',
  '332': 'A332',
  '333': 'A333',
  '338': 'A338',
  '339': 'A339',
  '340': 'A343',
  '350': 'A359',
  '359': 'A359',
  '380': 'A388',
  '737': 'B737',
  '738': 'B738',
  '739': 'B739',
  '73H': 'B738',
  '73J': 'B739',
  '744': 'B744',
  '747': 'B744',
  '767': 'B763',
  '772': 'B772',
  '773': 'B773',
  '77W': 'B77W',
  '77L': 'B77L',
  '787': 'B788',
  '788': 'B788',
  '789': 'B789',
  '78J': 'B789',
  'E90': 'E190',
  'E95': 'E195',
  'CR9': 'CRJ9',
  'AT7': 'AT76',
  'DH4': 'DH8D',
}
