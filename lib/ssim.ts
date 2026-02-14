/**
 * SSIM Chapter 7 parser and generator utilities.
 * Handles Record Type 1 (header), Type 2 (flight leg), Type 5 (trailer).
 * Type 2 is 200-byte fixed-width with 1-based column positions.
 */

// ─── Types ───────────────────────────────────────────────────

export interface SsimRecord {
  airline: string
  flightNumber: string
  serviceType: string
  effectiveFrom: string   // YYYY-MM-DD
  effectiveTo: string     // YYYY-MM-DD
  daysOfWeek: string      // "1234567" format (our DB format)
  departureIata: string
  std: string             // HHMM
  arrivalIata: string
  sta: string             // HHMM
  aircraftType: string    // IATA 3-letter
  rawLine: string
  lineNumber: number
  errors: string[]
}

export interface SsimParseResult {
  records: SsimRecord[]
  headerCarrier: string
  totalLines: number
  errors: { line: number; message: string; raw: string }[]
}

// ─── Month mapping ───────────────────────────────────────────

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** Parse ddMMMyy → YYYY-MM-DD */
function parseSsimDate(s: string): string {
  if (!s || s.trim().length < 7) return ''
  const dd = s.slice(0, 2)
  const mmm = s.slice(2, 5).toUpperCase()
  const yy = s.slice(5, 7)
  const monthIdx = MONTHS.indexOf(mmm)
  if (monthIdx < 0) return ''
  const year = parseInt(yy) < 70 ? 2000 + parseInt(yy) : 1900 + parseInt(yy)
  return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${dd}`
}

/** Format YYYY-MM-DD → ddMMMyy */
function formatSsimDate(dateStr: string): string {
  if (!dateStr) return '       '
  const [y, m, d] = dateStr.split('-')
  const mmm = MONTHS[parseInt(m) - 1] || 'JAN'
  const yy = y.slice(2)
  return `${d}${mmm}${yy}`
}

/** Convert SSIM DOW "1 3 5  " (7 chars, space = non-op) → DB format "135" */
function parseSsimDow(s: string): string {
  let result = ''
  for (let i = 0; i < 7 && i < s.length; i++) {
    if (s[i] !== ' ') result += s[i]
  }
  return result
}

/** Convert DB DOW "135" → SSIM DOW "1 3 5  " (7 chars) */
function formatSsimDow(dow: string): string {
  let result = ''
  for (let i = 1; i <= 7; i++) {
    result += dow.includes(String(i)) ? String(i) : ' '
  }
  return result
}

// ─── Parser ──────────────────────────────────────────────────

/**
 * Parse SSIM Chapter 7 content.
 * Record Type 2 field positions (0-based):
 *   [0]     = Record type '2'
 *   [1]     = Operational suffix
 *   [2-3]   = Airline designator
 *   [4-7]   = Flight number (4 digits, right-justified)
 *   [8]     = Itinerary variation
 *   [9-10]  = Leg sequence
 *   [11]    = Service type
 *   [12-18] = Period from (ddMMMyy)
 *   [19-25] = Period to (ddMMMyy)
 *   [26-32] = Days of operation (7 chars)
 *   [33-35] = Frequency rate
 *   [36-38] = Departure station
 *   [39-42] = STD passenger (HHMM)
 *   [43-46] = STD aircraft (HHMM)
 *   [47-51] = UTC variation departure
 *   [52-54] = Arrival station
 *   [55-58] = STA passenger (HHMM)
 *   [59-62] = STA aircraft (HHMM)
 *   [63-67] = UTC variation arrival
 *   [68-70] = Aircraft type (IATA 3-letter)
 */
export function parseSsim(content: string): SsimParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const records: SsimRecord[] = []
  const errors: { line: number; message: string; raw: string }[] = []
  let headerCarrier = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1
    const recordType = line[0]

    if (recordType === '1') {
      // Header — extract carrier from positions 3-4 (0-based: 2-3)
      headerCarrier = line.slice(2, 4).trim()
      continue
    }

    if (recordType === '5' || recordType === '3' || recordType === '4') {
      continue // Skip trailer, segment, supplementary records
    }

    if (recordType !== '2') {
      // Try to parse as Type 2 if line is long enough
      if (line.length < 71) {
        errors.push({ line: lineNum, message: 'Unknown record type or too short', raw: line })
        continue
      }
    }

    if (line.length < 71) {
      errors.push({ line: lineNum, message: `Record too short (${line.length} chars, need at least 71)`, raw: line })
      continue
    }

    const rec: SsimRecord = {
      airline: line.slice(2, 4).trim(),
      flightNumber: line.slice(2, 8).trim().replace(/^(\D+)0*/, '$1'), // "HZ0100" → "HZ100"
      serviceType: line[11]?.trim() || 'J',
      effectiveFrom: parseSsimDate(line.slice(12, 19)),
      effectiveTo: parseSsimDate(line.slice(19, 26)),
      daysOfWeek: parseSsimDow(line.slice(26, 33)),
      departureIata: line.slice(36, 39).trim(),
      std: line.slice(39, 43).trim(),
      arrivalIata: line.slice(52, 55).trim(),
      sta: line.slice(55, 59).trim(),
      aircraftType: line.slice(68, 71).trim(),
      rawLine: line,
      lineNumber: lineNum,
      errors: [],
    }

    // Validate
    if (!rec.flightNumber) rec.errors.push('Missing flight number')
    if (!rec.departureIata || rec.departureIata.length !== 3) rec.errors.push('Invalid departure airport')
    if (!rec.arrivalIata || rec.arrivalIata.length !== 3) rec.errors.push('Invalid arrival airport')
    if (rec.std && !/^\d{4}$/.test(rec.std)) rec.errors.push('Invalid STD format')
    if (rec.sta && !/^\d{4}$/.test(rec.sta)) rec.errors.push('Invalid STA format')
    if (!rec.daysOfWeek) rec.errors.push('No operating days specified')
    if (!rec.effectiveFrom) rec.errors.push('Invalid effective-from date')

    if (rec.errors.length > 0) {
      errors.push({ line: lineNum, message: rec.errors.join('; '), raw: line })
    }

    records.push(rec)
  }

  return { records, headerCarrier, totalLines: lines.length, errors }
}

// ─── Generator ───────────────────────────────────────────────

export interface SsimFlightInput {
  flightNumber: string
  departureIata: string
  arrivalIata: string
  std: string
  sta: string
  daysOfWeek: string
  aircraftTypeIata: string
  serviceType: string
  effectiveFrom: string
  effectiveTo: string
}

/** Generate a complete SSIM Chapter 7 file */
export function generateSsim(
  carrierCode: string,
  seasonCode: string,
  flights: SsimFlightInput[],
): string {
  const lines: string[] = []
  const carrier = carrierCode.padEnd(2).slice(0, 2)

  // Record Type 1 — Header
  const header = '1'
    + ' '             // serial
    + carrier         // airline
    + '   '           // spare
    + seasonCode.padEnd(6).slice(0, 6) // season
    + '       '       // period from (optional)
    + '       '       // period to
    + formatSsimDate(new Date().toISOString().split('T')[0]) // creation date
    + 'SSIM'          // data title
    + ' '             // quality indicator
    + carrier         // airline (dup)
  lines.push(header.padEnd(200))

  // Record Type 2 — Flight legs
  for (const f of flights) {
    // Extract numeric part + carrier from flight number
    const fltNumOnly = f.flightNumber.replace(/\D/g, '')
    const fltPadded = fltNumOnly.padStart(4, '0')

    const rec = '2'                                        // [0]    Record type
      + ' '                                              // [1]    Op suffix
      + carrier                                          // [2-3]  Airline
      + fltPadded                                        // [4-7]  Flight number
      + ' '                                              // [8]    Itinerary var
      + '01'                                             // [9-10] Leg sequence
      + (f.serviceType || 'J').slice(0, 1)               // [11]   Service type
      + formatSsimDate(f.effectiveFrom)                  // [12-18] From
      + formatSsimDate(f.effectiveTo)                    // [19-25] To
      + formatSsimDow(f.daysOfWeek)                      // [26-32] DOW
      + '   '                                            // [33-35] Freq rate
      + f.departureIata.padEnd(3).slice(0, 3)            // [36-38] DEP
      + (f.std || '0000').padEnd(4).slice(0, 4)          // [39-42] STD pax
      + (f.std || '0000').padEnd(4).slice(0, 4)          // [43-46] STD a/c
      + '     '                                          // [47-51] UTC var dep
      + f.arrivalIata.padEnd(3).slice(0, 3)              // [52-54] ARR
      + (f.sta || '0000').padEnd(4).slice(0, 4)          // [55-58] STA pax
      + (f.sta || '0000').padEnd(4).slice(0, 4)          // [59-62] STA a/c
      + '     '                                          // [63-67] UTC var arr
      + (f.aircraftTypeIata || '   ').padEnd(3).slice(0, 3) // [68-70] A/C type

    lines.push(rec.padEnd(200))
  }

  // Record Type 5 — Trailer
  const trailer = '5' + carrier + String(flights.length).padStart(6, '0')
  lines.push(trailer.padEnd(200))

  return lines.join('\n')
}

// ─── ASM/SSM Helpers ─────────────────────────────────────────

export const ASM_ACTION_CODES = ['NEW', 'TIM', 'CNL', 'EQT', 'CON', 'RIN', 'RPL', 'FLT', 'SKD'] as const
export type AsmActionCode = typeof ASM_ACTION_CODES[number]

export interface AsmParsed {
  messageType: 'ASM' | 'SSM'
  actionCode: AsmActionCode | string
  airline: string
  flightNumber: string
  flightDate: string        // YYYY-MM-DD
  changes: Record<string, { from?: string; to: string }>
  rawMessage: string
  errors: string[]
}

/**
 * Parse a simplified ASM/SSM message.
 * Expected format:
 *   ASM (or SSM)
 *   TIM (action code)
 *   HZ100/15MAR25
 *   DEL0830 BOM1145
 *   738
 *
 * Or inline format:
 *   ASM TIM HZ100/15MAR25 DEL0830-BOM1145 738
 */
export function parseAsmMessage(raw: string): AsmParsed {
  const result: AsmParsed = {
    messageType: 'ASM',
    actionCode: '',
    airline: '',
    flightNumber: '',
    flightDate: '',
    changes: {},
    rawMessage: raw,
    errors: [],
  }

  const lines = raw.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) { result.errors.push('Empty message'); return result }

  // Detect message type
  const firstLine = lines[0].toUpperCase()
  if (firstLine.startsWith('SSM')) result.messageType = 'SSM'

  // Try to extract: message type, action code, flight/date on first few lines
  const allText = lines.join(' ').toUpperCase()

  // Extract action code
  for (const code of ASM_ACTION_CODES) {
    if (allText.includes(code)) {
      result.actionCode = code
      break
    }
  }
  if (!result.actionCode) result.errors.push('No valid action code found')

  // Extract flight number and date: pattern like "HZ100/15MAR25" or "HZ 100/15MAR25"
  const fltMatch = allText.match(/([A-Z]{2})\s*(\d{1,4})\s*\/\s*(\d{2}[A-Z]{3}\d{2})/)
  if (fltMatch) {
    result.airline = fltMatch[1]
    result.flightNumber = fltMatch[1] + fltMatch[2]
    result.flightDate = parseSsimDate(fltMatch[3])
  } else {
    // Try without date
    const fltOnly = allText.match(/([A-Z]{2})\s*(\d{1,4})/)
    if (fltOnly) {
      result.airline = fltOnly[1]
      result.flightNumber = fltOnly[1] + fltOnly[2]
    }
    result.errors.push('Could not parse flight number/date')
  }

  // Extract time changes for TIM action: look for HHMM patterns
  if (result.actionCode === 'TIM') {
    const timePattern = /(\d{4})\s+(\d{4})/g
    const times = Array.from(allText.matchAll(timePattern))
    if (times.length >= 1) {
      result.changes['std'] = { from: undefined, to: times[0][1] }
      if (times.length >= 2) {
        result.changes['sta'] = { from: undefined, to: times[0][2] }
      }
    }
  }

  // Extract airport codes: 3-letter codes
  const aptPattern = /\b([A-Z]{3})(\d{4})\b/g
  const airports = Array.from(allText.matchAll(aptPattern))
  if (airports.length >= 1) {
    result.changes['departure_iata'] = { to: airports[0][1] }
    result.changes['std'] = { to: airports[0][2] }
  }
  if (airports.length >= 2) {
    result.changes['arrival_iata'] = { to: airports[1][1] }
    result.changes['sta'] = { to: airports[1][2] }
  }

  // Extract aircraft type: 3-char alphanumeric at end or after airports
  const acMatch = allText.match(/\b(\d{3}|[A-Z]\d{2}|[A-Z]{3})\s*$/)
  if (acMatch && result.actionCode === 'EQT') {
    result.changes['aircraft_type'] = { to: acMatch[1] }
  }

  return result
}

/**
 * Generate an ASM message for a schedule change.
 */
export function generateAsmMessage(input: {
  actionCode: string
  airline: string
  flightNumber: string
  flightDate: string
  changes: Record<string, { from?: string; to: string }>
}): string {
  const dateFmt = formatSsimDate(input.flightDate)
  const lines = [
    'ASM',
    input.actionCode,
    `${input.flightNumber}/${dateFmt}`,
  ]

  if (input.actionCode === 'TIM' && input.changes['std']) {
    const from = input.changes['std'].from || '????'
    const to = input.changes['std'].to
    lines.push(`- ${from}`)
    lines.push(`+ ${to}`)
  }

  if (input.actionCode === 'EQT' && input.changes['aircraft_type']) {
    lines.push(`- ${input.changes['aircraft_type'].from || '???'}`)
    lines.push(`+ ${input.changes['aircraft_type'].to}`)
  }

  if (input.actionCode === 'CNL') {
    lines.push('CANCELLED')
  }

  if (input.actionCode === 'NEW') {
    const dep = input.changes['departure_iata']?.to || '???'
    const arr = input.changes['arrival_iata']?.to || '???'
    const std = input.changes['std']?.to || '0000'
    const sta = input.changes['sta']?.to || '0000'
    lines.push(`${dep}${std} ${arr}${sta}`)
    if (input.changes['aircraft_type']?.to) lines.push(input.changes['aircraft_type'].to)
  }

  return lines.join('\n')
}
