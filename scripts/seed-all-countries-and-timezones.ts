/**
 * Fetches ALL countries from restcountries.com and seeds:
 * 1. Countries table (~250 countries via upsert)
 * 2. Timezone zones for each country
 * 3. Links airports to their timezone zones
 *
 * Run: npx tsx scripts/seed-all-countries-and-timezones.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────

interface RestCountry {
  name: { common: string; official: string }
  cca2: string
  cca3: string
  ccn3?: string
  region: string
  subregion?: string
  currencies?: Record<string, { name: string; symbol: string }>
  idd?: { root?: string; suffixes?: string[] }
  flag?: string
  latlng?: [number, number]
  timezones?: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Compute UTC offset for an IANA timezone using Intl API */
function getUTCOffset(ianaTimezone: string): string {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'longOffset',
    })
    const parts = formatter.formatToParts(now)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    if (tzPart?.value) {
      // Format like "GMT+7" or "GMT-5:30" or "GMT+05:30"
      const match = tzPart.value.match(/GMT([+-]\d{1,2}(?::\d{2})?)/)
      if (match) {
        const raw = match[1]
        // Normalize to ±HH:MM
        const parts = raw.split(':')
        const hours = parts[0].replace('+', '+').padStart(3, '0').replace('-0', '-0')
        const mins = parts[1] || '00'
        const sign = raw.startsWith('-') ? '-' : '+'
        const hh = Math.abs(parseInt(parts[0])).toString().padStart(2, '0')
        return `${sign}${hh}:${mins}`
      }
      if (tzPart.value === 'GMT') return '+00:00'
    }
    return '+00:00'
  } catch {
    return '+00:00'
  }
}

/** Check if a timezone observes DST by comparing Jan vs Jul offsets */
function checkDSTObserved(ianaTimezone: string): boolean {
  try {
    const year = new Date().getFullYear()
    const jan = new Date(year, 0, 15, 12, 0, 0)
    const jul = new Date(year, 6, 15, 12, 0, 0)

    const fmt = (d: Date) => {
      const f = new Intl.DateTimeFormat('en-US', {
        timeZone: ianaTimezone,
        timeZoneName: 'longOffset',
      })
      const parts = f.formatToParts(d)
      return parts.find(p => p.type === 'timeZoneName')?.value || ''
    }

    return fmt(jan) !== fmt(jul)
  } catch {
    return false
  }
}

/** Derive a friendly zone name from IANA timezone string */
function deriveZoneName(iana: string): string {
  // e.g. "America/New_York" → "New York"
  // e.g. "America/Indiana/Indianapolis" → "Indianapolis"
  // e.g. "Pacific/Honolulu" → "Honolulu"
  // e.g. "Asia/Ho_Chi_Minh" → "Ho Chi Minh"
  const parts = iana.split('/')
  const city = parts[parts.length - 1].replace(/_/g, ' ')
  return city
}

/** Map restcountries region/subregion to our region naming */
function mapRegion(region: string, subregion?: string): string {
  // Use subregion if available for more specific grouping
  if (subregion) {
    const subMap: Record<string, string> = {
      'South-Eastern Asia': 'Southeast Asia',
      'Eastern Asia': 'East Asia',
      'Southern Asia': 'South Asia',
      'Western Asia': 'Middle East',
      'Central Asia': 'Central Asia',
      'Northern Europe': 'Europe',
      'Western Europe': 'Europe',
      'Eastern Europe': 'Europe',
      'Southern Europe': 'Europe',
      'Northern America': 'Americas',
      'South America': 'Americas',
      'Central America': 'Americas',
      'Caribbean': 'Americas',
      'Northern Africa': 'Africa',
      'Western Africa': 'Africa',
      'Eastern Africa': 'Africa',
      'Southern Africa': 'Africa',
      'Middle Africa': 'Africa',
      'Australia and New Zealand': 'Oceania',
      'Melanesia': 'Oceania',
      'Micronesia': 'Oceania',
      'Polynesia': 'Oceania',
    }
    return subMap[subregion] || region
  }
  return region || 'Other'
}

// ─── Critical country timezone definitions ───────────────────────────────
// These ensure important countries have all their sub-zones

interface ManualZone {
  zone_code: string
  iana_timezone: string
  zone_name: string
}

const CRITICAL_ZONES: Record<string, ManualZone[]> = {
  US: [
    { zone_code: '1', iana_timezone: 'America/New_York', zone_name: 'New York (Eastern)' },
    { zone_code: '2', iana_timezone: 'America/Chicago', zone_name: 'Chicago (Central)' },
    { zone_code: '3', iana_timezone: 'America/Denver', zone_name: 'Denver (Mountain)' },
    { zone_code: '3A', iana_timezone: 'America/Phoenix', zone_name: 'Phoenix (Mountain No DST)' },
    { zone_code: '4', iana_timezone: 'America/Los_Angeles', zone_name: 'Los Angeles (Pacific)' },
    { zone_code: '5', iana_timezone: 'America/Anchorage', zone_name: 'Anchorage (Alaska)' },
    { zone_code: '6', iana_timezone: 'Pacific/Honolulu', zone_name: 'Honolulu (Hawaii)' },
  ],
  CA: [
    { zone_code: '1', iana_timezone: 'America/St_Johns', zone_name: 'St. Johns (Newfoundland)' },
    { zone_code: '2', iana_timezone: 'America/Halifax', zone_name: 'Halifax (Atlantic)' },
    { zone_code: '3', iana_timezone: 'America/Toronto', zone_name: 'Toronto (Eastern)' },
    { zone_code: '3A', iana_timezone: 'America/Regina', zone_name: 'Regina (Saskatchewan No DST)' },
    { zone_code: '4', iana_timezone: 'America/Winnipeg', zone_name: 'Winnipeg (Central)' },
    { zone_code: '5', iana_timezone: 'America/Edmonton', zone_name: 'Edmonton (Mountain)' },
    { zone_code: '6', iana_timezone: 'America/Vancouver', zone_name: 'Vancouver (Pacific)' },
  ],
  AU: [
    { zone_code: '1', iana_timezone: 'Australia/Sydney', zone_name: 'Sydney (AEST)' },
    { zone_code: '1A', iana_timezone: 'Australia/Brisbane', zone_name: 'Brisbane (AEST No DST)' },
    { zone_code: '2', iana_timezone: 'Australia/Adelaide', zone_name: 'Adelaide (ACST)' },
    { zone_code: '2A', iana_timezone: 'Australia/Darwin', zone_name: 'Darwin (ACST No DST)' },
    { zone_code: '3', iana_timezone: 'Australia/Perth', zone_name: 'Perth (AWST)' },
  ],
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== STEP 1: Fetch countries from restcountries.com ===\n')

  // restcountries.com limits to 10 fields per request — fetch in two calls and merge
  const fields1 = 'name,cca2,cca3,ccn3,region,subregion,currencies,idd,flag,latlng'
  const fields2 = 'cca2,timezones'

  const [res1, res2] = await Promise.all([
    fetch(`https://restcountries.com/v3.1/all?fields=${fields1}`),
    fetch(`https://restcountries.com/v3.1/all?fields=${fields2}`),
  ])
  if (!res1.ok) throw new Error(`Fetch 1 failed: ${res1.status}`)
  if (!res2.ok) throw new Error(`Fetch 2 failed: ${res2.status}`)

  const data1: RestCountry[] = await res1.json()
  const data2: Array<{ cca2: string; timezones: string[] }> = await res2.json()

  // Merge timezones into main data by cca2
  const tzMap = new Map(data2.map(d => [d.cca2, d.timezones]))
  const apiCountries: RestCountry[] = data1.map(c => ({
    ...c,
    timezones: tzMap.get(c.cca2) || [],
  }))
  console.log(`Fetched ${apiCountries.length} countries from API\n`)

  // ─── STEP 2: Seed countries ──────────────────────────────────
  console.log('=== STEP 2: Upsert countries ===\n')

  // Get existing countries for icao_prefix preservation
  const { data: existingCountries } = await supabase.from('countries').select('iso_code_2, icao_prefix')
  const icaoPrefixMap = new Map<string, string>()
  for (const c of existingCountries || []) {
    if (c.icao_prefix) icaoPrefixMap.set(c.iso_code_2, c.icao_prefix)
  }

  const countryRows = apiCountries.map((c) => {
    const currencyKeys = c.currencies ? Object.keys(c.currencies) : []
    const firstCurrency = currencyKeys[0] ? c.currencies![currencyKeys[0]] : null
    const phoneCode = c.idd?.root && c.idd.suffixes?.length
      ? `${c.idd.root}${c.idd.suffixes[0]}`
      : null

    return {
      iso_code_2: c.cca2,
      iso_code_3: c.cca3,
      name: c.name.common,
      official_name: c.name.official,
      region: mapRegion(c.region, c.subregion),
      sub_region: c.subregion || null,
      currency_code: currencyKeys[0] || null,
      currency_name: firstCurrency?.name || null,
      currency_symbol: firstCurrency?.symbol || null,
      iso_numeric: c.ccn3 || null,
      phone_code: phoneCode,
      flag_emoji: c.flag || null,
      latitude: c.latlng?.[0] ?? null,
      longitude: c.latlng?.[1] ?? null,
      // Preserve existing icao_prefix if we have one
      icao_prefix: icaoPrefixMap.get(c.cca2) || null,
      is_active: true,
    }
  })

  // Upsert in batches of 50
  let countriesSeeded = 0
  let countryErrors: string[] = []

  for (let i = 0; i < countryRows.length; i += 50) {
    const batch = countryRows.slice(i, i + 50)
    const { error } = await supabase
      .from('countries')
      .upsert(batch, { onConflict: 'iso_code_2' })

    if (error) {
      countryErrors.push(`Batch ${i}-${i + batch.length}: ${error.message}`)
      console.error(`  Error batch ${i}: ${error.message}`)
    } else {
      countriesSeeded += batch.length
      process.stdout.write(`  Upserted ${countriesSeeded}/${countryRows.length}\r`)
    }
  }
  console.log(`\nCountries upserted: ${countriesSeeded}`)
  if (countryErrors.length) console.log(`  Errors: ${countryErrors.length}`)

  // ─── STEP 3: Seed timezone zones ────────────────────────────
  console.log('\n=== STEP 3: Seed timezone zones ===\n')

  // Fetch IANA zone1970.tab for authoritative country→timezone mapping
  console.log('  Fetching IANA zone1970.tab...')
  const zoneTabRes = await fetch('https://raw.githubusercontent.com/eggert/tz/main/zone1970.tab')
  if (!zoneTabRes.ok) throw new Error(`Failed to fetch zone1970.tab: ${zoneTabRes.status}`)
  const zoneTabText = await zoneTabRes.text()

  // Parse zone1970.tab: country_codes(comma-sep) \t coordinates \t timezone \t comments
  const countryToTimezones = new Map<string, Array<{ iana: string; comment: string }>>()
  for (const line of zoneTabText.split('\n')) {
    if (line.startsWith('#') || !line.trim()) continue
    const cols = line.split('\t')
    if (cols.length < 3) continue
    const countryCodes = cols[0].split(',')
    const iana = cols[2]
    const comment = cols[3] || ''
    for (const cc of countryCodes) {
      if (!countryToTimezones.has(cc)) countryToTimezones.set(cc, [])
      countryToTimezones.get(cc)!.push({ iana, comment })
    }
  }
  console.log(`  Parsed ${countryToTimezones.size} countries from zone1970.tab`)

  // Get all countries with their IDs
  const { data: allCountries } = await supabase.from('countries').select('id, iso_code_2')
  if (!allCountries?.length) throw new Error('No countries found after seeding')

  const countryIdMap = new Map<string, string>()
  for (const c of allCountries) {
    countryIdMap.set(c.iso_code_2, c.id)
  }

  // Build timezone zones
  const allZoneRows: Array<{
    country_id: string
    zone_code: string
    zone_name: string
    iana_timezone: string
    utc_offset: string
    dst_observed: boolean
    is_active: boolean
  }> = []

  // Track which IANA timezones are already covered per country (for dedup)
  const coveredTimezones = new Map<string, Set<string>>()

  // First: add critical zones for US, CA, AU (these override auto-generated ones)
  for (const [iso2, zones] of Object.entries(CRITICAL_ZONES)) {
    const countryId = countryIdMap.get(iso2)
    if (!countryId) continue

    const covered = new Set<string>()
    coveredTimezones.set(iso2, covered)

    for (const z of zones) {
      covered.add(z.iana_timezone)
      allZoneRows.push({
        country_id: countryId,
        zone_code: z.zone_code,
        zone_name: z.zone_name,
        iana_timezone: z.iana_timezone,
        utc_offset: getUTCOffset(z.iana_timezone),
        dst_observed: checkDSTObserved(z.iana_timezone),
        is_active: true,
      })
    }
  }

  // Then: add zones from IANA zone1970.tab for all countries
  for (const [iso2, tzEntries] of countryToTimezones) {
    const countryId = countryIdMap.get(iso2)
    if (!countryId) continue

    const covered = coveredTimezones.get(iso2) || new Set<string>()
    if (!coveredTimezones.has(iso2)) coveredTimezones.set(iso2, covered)

    let nextCode = 1
    // Find the next available code (after critical zones)
    const existingCodes = allZoneRows
      .filter(r => r.country_id === countryId)
      .map(r => parseInt(r.zone_code) || 0)
    if (existingCodes.length > 0) {
      nextCode = Math.max(...existingCodes) + 1
    }

    for (const { iana } of tzEntries) {
      if (covered.has(iana)) continue
      covered.add(iana)

      allZoneRows.push({
        country_id: countryId,
        zone_code: String(nextCode++),
        zone_name: deriveZoneName(iana),
        iana_timezone: iana,
        utc_offset: getUTCOffset(iana),
        dst_observed: checkDSTObserved(iana),
        is_active: true,
      })
    }
  }

  console.log(`Total timezone zones to insert: ${allZoneRows.length}`)

  // Clear airport references first (FK constraint), then delete all zones
  console.log('  Clearing airport timezone references...')
  await supabase.from('airports').update({ timezone_zone_id: null }).neq('id', '00000000-0000-0000-0000-000000000000')

  console.log('  Clearing existing timezone zones...')
  const { error: deleteError } = await supabase.from('timezone_zones').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (deleteError) console.error('  Error clearing zones:', deleteError.message)

  let zonesCreated = 0
  let zoneErrors: string[] = []

  for (let i = 0; i < allZoneRows.length; i += 100) {
    const batch = allZoneRows.slice(i, i + 100)
    const { error } = await supabase.from('timezone_zones').insert(batch)

    if (error) {
      zoneErrors.push(`Batch ${i}-${i + batch.length}: ${error.message}`)
      console.error(`  Error batch ${i}: ${error.message}`)
    } else {
      zonesCreated += batch.length
      process.stdout.write(`  Inserted ${zonesCreated}/${allZoneRows.length}\r`)
    }
  }
  console.log(`\nTimezone zones created: ${zonesCreated}`)
  if (zoneErrors.length) console.log(`  Errors: ${zoneErrors.length}`)

  // ─── STEP 4: Link airports to timezone zones ────────────────
  console.log('\n=== STEP 4: Link airports to timezone zones ===\n')

  // Get all airports with their timezone info
  const { data: airports } = await supabase
    .from('airports')
    .select('id, country_id, timezone, icao_code')

  // Get all timezone zones indexed by country_id + iana_timezone
  const { data: zones } = await supabase.from('timezone_zones').select('id, country_id, iana_timezone')

  const zoneMap = new Map<string, string>()
  for (const z of zones || []) {
    zoneMap.set(`${z.country_id}:${z.iana_timezone}`, z.id)
  }

  let airportsLinked = 0
  let airportsUnmatched = 0

  for (const airport of airports || []) {
    if (!airport.timezone || !airport.country_id) {
      airportsUnmatched++
      continue
    }

    const key = `${airport.country_id}:${airport.timezone}`
    const zoneId = zoneMap.get(key)

    if (zoneId) {
      const { error } = await supabase
        .from('airports')
        .update({ timezone_zone_id: zoneId })
        .eq('id', airport.id)

      if (error) {
        console.error(`  Error linking ${airport.icao_code}: ${error.message}`)
        airportsUnmatched++
      } else {
        airportsLinked++
      }
    } else {
      airportsUnmatched++
    }
  }

  console.log(`Airports linked: ${airportsLinked}`)
  console.log(`Airports unmatched: ${airportsUnmatched}`)

  // ─── STEP 5: Final report ───────────────────────────────────
  console.log('\n' + '='.repeat(50))
  console.log('=== SEED COMPLETE ===')
  console.log('='.repeat(50))
  console.log(`Countries seeded/updated: ${countriesSeeded}`)
  console.log(`Timezone zones created:   ${zonesCreated}`)
  console.log(`Airports linked:          ${airportsLinked}`)
  console.log(`Airports unmatched:       ${airportsUnmatched}`)

  if (countryErrors.length > 0) {
    console.log(`\nCountry errors:`)
    countryErrors.forEach(e => console.log(`  - ${e}`))
  }
  if (zoneErrors.length > 0) {
    console.log(`\nTimezone zone errors:`)
    zoneErrors.forEach(e => console.log(`  - ${e}`))
  }
}

main().catch(e => {
  console.error('\nFATAL ERROR:', e)
  process.exit(1)
})
