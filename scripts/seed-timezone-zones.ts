import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedTimezoneZones() {
  console.log('🕐 Starting timezone zones seeding...\n')

  try {
    // Verify schema exists by attempting a lightweight query
    const { error: schemaCheck } = await supabase
      .from('timezone_zones')
      .select('id')
      .limit(1)

    if (schemaCheck) {
      console.error('❌ timezone_zones table not found.')
      console.log('\n📋 Please run the migration SQL first:')
      console.log('   1. Open Supabase Dashboard → SQL Editor')
      console.log('   2. Paste the contents of: supabase/migrations/009_timezone_zones.sql')
      console.log('   3. Click "Run"')
      console.log('   4. Then re-run this seed script\n')
      process.exit(1)
    }

    // 1. Get country IDs
    console.log('🌍 Fetching country IDs...')
    const { data: countries } = await supabase
      .from('countries')
      .select('id, iso_code_2')

    if (!countries || countries.length === 0) {
      console.error('   ❌ No countries found. Run seed-database.ts first.')
      return
    }

    const countryMap = new Map(countries.map((c) => [c.iso_code_2, c.id]))
    console.log(`   ✅ Found ${countries.length} countries`)

    // 2. Update country metadata (new fields)
    console.log('\n📝 Updating country metadata...')
    const countryMetadata: Record<string, { iso_numeric?: string; sub_region?: string; currency_name?: string; currency_symbol?: string; phone_code?: string }> = {
      VN: { iso_numeric: '704', sub_region: 'South-Eastern Asia', currency_name: 'Vietnamese Dong', currency_symbol: '₫', phone_code: '+84' },
      TH: { iso_numeric: '764', sub_region: 'South-Eastern Asia', currency_name: 'Thai Baht', currency_symbol: '฿', phone_code: '+66' },
      SG: { iso_numeric: '702', sub_region: 'South-Eastern Asia', currency_name: 'Singapore Dollar', currency_symbol: 'S$', phone_code: '+65' },
      MY: { iso_numeric: '458', sub_region: 'South-Eastern Asia', currency_name: 'Malaysian Ringgit', currency_symbol: 'RM', phone_code: '+60' },
      PH: { iso_numeric: '608', sub_region: 'South-Eastern Asia', currency_name: 'Philippine Peso', currency_symbol: '₱', phone_code: '+63' },
      ID: { iso_numeric: '360', sub_region: 'South-Eastern Asia', currency_name: 'Indonesian Rupiah', currency_symbol: 'Rp', phone_code: '+62' },
      JP: { iso_numeric: '392', sub_region: 'Eastern Asia', currency_name: 'Japanese Yen', currency_symbol: '¥', phone_code: '+81' },
      KR: { iso_numeric: '410', sub_region: 'Eastern Asia', currency_name: 'South Korean Won', currency_symbol: '₩', phone_code: '+82' },
      CN: { iso_numeric: '156', sub_region: 'Eastern Asia', currency_name: 'Chinese Yuan', currency_symbol: '¥', phone_code: '+86' },
      HK: { iso_numeric: '344', sub_region: 'Eastern Asia', currency_name: 'Hong Kong Dollar', currency_symbol: 'HK$', phone_code: '+852' },
      TW: { iso_numeric: '158', sub_region: 'Eastern Asia', currency_name: 'New Taiwan Dollar', currency_symbol: 'NT$', phone_code: '+886' },
      IN: { iso_numeric: '356', sub_region: 'Southern Asia', currency_name: 'Indian Rupee', currency_symbol: '₹', phone_code: '+91' },
      AE: { iso_numeric: '784', sub_region: 'Western Asia', currency_name: 'UAE Dirham', currency_symbol: 'د.إ', phone_code: '+971' },
      QA: { iso_numeric: '634', sub_region: 'Western Asia', currency_name: 'Qatari Riyal', currency_symbol: 'ر.ق', phone_code: '+974' },
      GB: { iso_numeric: '826', sub_region: 'Northern Europe', currency_name: 'Pound Sterling', currency_symbol: '£', phone_code: '+44' },
      FR: { iso_numeric: '250', sub_region: 'Western Europe', currency_name: 'Euro', currency_symbol: '€', phone_code: '+33' },
      DE: { iso_numeric: '276', sub_region: 'Western Europe', currency_name: 'Euro', currency_symbol: '€', phone_code: '+49' },
      NL: { iso_numeric: '528', sub_region: 'Western Europe', currency_name: 'Euro', currency_symbol: '€', phone_code: '+31' },
      AU: { iso_numeric: '036', sub_region: 'Oceania', currency_name: 'Australian Dollar', currency_symbol: 'A$', phone_code: '+61' },
      US: { iso_numeric: '840', sub_region: 'Northern America', currency_name: 'US Dollar', currency_symbol: '$', phone_code: '+1' },
      KH: { iso_numeric: '116', sub_region: 'South-Eastern Asia', currency_name: 'Cambodian Riel', currency_symbol: '៛', phone_code: '+855' },
      MM: { iso_numeric: '104', sub_region: 'South-Eastern Asia', currency_name: 'Myanmar Kyat', currency_symbol: 'K', phone_code: '+95' },
      LA: { iso_numeric: '418', sub_region: 'South-Eastern Asia', currency_name: 'Lao Kip', currency_symbol: '₭', phone_code: '+856' },
      NZ: { iso_numeric: '554', sub_region: 'Oceania', currency_name: 'New Zealand Dollar', currency_symbol: 'NZ$', phone_code: '+64' },
      CA: { iso_numeric: '124', sub_region: 'Northern America', currency_name: 'Canadian Dollar', currency_symbol: 'C$', phone_code: '+1' },
    }

    let metaUpdated = 0
    for (const [iso, meta] of Object.entries(countryMetadata)) {
      const id = countryMap.get(iso)
      if (!id) continue
      const { error } = await supabase.from('countries').update(meta).eq('id', id)
      if (error) {
        console.error(`   ❌ Error updating ${iso}:`, error.message)
      } else {
        metaUpdated++
      }
    }
    console.log(`   ✅ Updated ${metaUpdated}/${Object.keys(countryMetadata).length} countries with metadata`)

    // 3. Seed timezone zones
    console.log('\n🕐 Seeding timezone zones...')

    interface ZoneSeed {
      country: string
      zones: {
        zone_code: number
        zone_name: string
        iana_timezone: string
        utc_offset: string
        has_dst: boolean
        dst_start?: string
        dst_end?: string
        dst_offset?: string
      }[]
    }

    const timezoneData: ZoneSeed[] = [
      { country: 'VN', zones: [
        { zone_code: 1, zone_name: 'Indochina', iana_timezone: 'Asia/Ho_Chi_Minh', utc_offset: '+07:00', has_dst: false },
      ]},
      { country: 'TH', zones: [
        { zone_code: 1, zone_name: 'Indochina', iana_timezone: 'Asia/Bangkok', utc_offset: '+07:00', has_dst: false },
      ]},
      { country: 'SG', zones: [
        { zone_code: 1, zone_name: 'Singapore', iana_timezone: 'Asia/Singapore', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'MY', zones: [
        { zone_code: 1, zone_name: 'Malaysia', iana_timezone: 'Asia/Kuala_Lumpur', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'PH', zones: [
        { zone_code: 1, zone_name: 'Philippine', iana_timezone: 'Asia/Manila', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'ID', zones: [
        { zone_code: 1, zone_name: 'Western (WIB)', iana_timezone: 'Asia/Jakarta', utc_offset: '+07:00', has_dst: false },
        { zone_code: 2, zone_name: 'Central (WITA)', iana_timezone: 'Asia/Makassar', utc_offset: '+08:00', has_dst: false },
        { zone_code: 3, zone_name: 'Eastern (WIT)', iana_timezone: 'Asia/Jayapura', utc_offset: '+09:00', has_dst: false },
      ]},
      { country: 'JP', zones: [
        { zone_code: 1, zone_name: 'Japan Standard', iana_timezone: 'Asia/Tokyo', utc_offset: '+09:00', has_dst: false },
      ]},
      { country: 'KR', zones: [
        { zone_code: 1, zone_name: 'Korea Standard', iana_timezone: 'Asia/Seoul', utc_offset: '+09:00', has_dst: false },
      ]},
      { country: 'CN', zones: [
        { zone_code: 1, zone_name: 'China Standard', iana_timezone: 'Asia/Shanghai', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'HK', zones: [
        { zone_code: 1, zone_name: 'Hong Kong', iana_timezone: 'Asia/Hong_Kong', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'TW', zones: [
        { zone_code: 1, zone_name: 'Taiwan Standard', iana_timezone: 'Asia/Taipei', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'IN', zones: [
        { zone_code: 1, zone_name: 'India Standard', iana_timezone: 'Asia/Kolkata', utc_offset: '+05:30', has_dst: false },
      ]},
      { country: 'AE', zones: [
        { zone_code: 1, zone_name: 'Gulf Standard', iana_timezone: 'Asia/Dubai', utc_offset: '+04:00', has_dst: false },
      ]},
      { country: 'QA', zones: [
        { zone_code: 1, zone_name: 'Arabia Standard', iana_timezone: 'Asia/Qatar', utc_offset: '+03:00', has_dst: false },
      ]},
      { country: 'GB', zones: [
        { zone_code: 1, zone_name: 'Greenwich/British Summer', iana_timezone: 'Europe/London', utc_offset: '+00:00', has_dst: true, dst_start: 'Last Sun Mar 01:00', dst_end: 'Last Sun Oct 02:00', dst_offset: '+01:00' },
      ]},
      { country: 'FR', zones: [
        { zone_code: 1, zone_name: 'Central European', iana_timezone: 'Europe/Paris', utc_offset: '+01:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'Last Sun Oct 03:00', dst_offset: '+01:00' },
      ]},
      { country: 'DE', zones: [
        { zone_code: 1, zone_name: 'Central European', iana_timezone: 'Europe/Berlin', utc_offset: '+01:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'Last Sun Oct 03:00', dst_offset: '+01:00' },
      ]},
      { country: 'NL', zones: [
        { zone_code: 1, zone_name: 'Central European', iana_timezone: 'Europe/Amsterdam', utc_offset: '+01:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'Last Sun Oct 03:00', dst_offset: '+01:00' },
      ]},
      { country: 'AU', zones: [
        { zone_code: 1, zone_name: 'Eastern (AEST)', iana_timezone: 'Australia/Sydney', utc_offset: '+10:00', has_dst: true, dst_start: 'First Sun Oct 02:00', dst_end: 'First Sun Apr 03:00', dst_offset: '+01:00' },
        { zone_code: 2, zone_name: 'Central (ACST)', iana_timezone: 'Australia/Adelaide', utc_offset: '+09:30', has_dst: true, dst_start: 'First Sun Oct 02:00', dst_end: 'First Sun Apr 03:00', dst_offset: '+01:00' },
        { zone_code: 3, zone_name: 'Western (AWST)', iana_timezone: 'Australia/Perth', utc_offset: '+08:00', has_dst: false },
      ]},
      { country: 'US', zones: [
        { zone_code: 1, zone_name: 'Eastern', iana_timezone: 'America/New_York', utc_offset: '-05:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'First Sun Nov 02:00', dst_offset: '+01:00' },
        { zone_code: 2, zone_name: 'Central', iana_timezone: 'America/Chicago', utc_offset: '-06:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'First Sun Nov 02:00', dst_offset: '+01:00' },
        { zone_code: 3, zone_name: 'Mountain', iana_timezone: 'America/Denver', utc_offset: '-07:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'First Sun Nov 02:00', dst_offset: '+01:00' },
        { zone_code: 4, zone_name: 'Pacific', iana_timezone: 'America/Los_Angeles', utc_offset: '-08:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'First Sun Nov 02:00', dst_offset: '+01:00' },
        { zone_code: 5, zone_name: 'Alaska', iana_timezone: 'America/Anchorage', utc_offset: '-09:00', has_dst: true, dst_start: 'Last Sun Mar 02:00', dst_end: 'First Sun Nov 02:00', dst_offset: '+01:00' },
        { zone_code: 6, zone_name: 'Hawaii', iana_timezone: 'Pacific/Honolulu', utc_offset: '-10:00', has_dst: false },
      ]},
      { country: 'KH', zones: [
        { zone_code: 1, zone_name: 'Indochina', iana_timezone: 'Asia/Phnom_Penh', utc_offset: '+07:00', has_dst: false },
      ]},
      { country: 'MM', zones: [
        { zone_code: 1, zone_name: 'Myanmar', iana_timezone: 'Asia/Yangon', utc_offset: '+06:30', has_dst: false },
      ]},
      { country: 'LA', zones: [
        { zone_code: 1, zone_name: 'Indochina', iana_timezone: 'Asia/Vientiane', utc_offset: '+07:00', has_dst: false },
      ]},
      { country: 'NZ', zones: [
        { zone_code: 1, zone_name: 'New Zealand Standard', iana_timezone: 'Pacific/Auckland', utc_offset: '+12:00', has_dst: true, dst_start: 'Last Sun Sep 02:00', dst_end: 'First Sun Apr 03:00', dst_offset: '+01:00' },
      ]},
    ]

    let zoneCount = 0
    for (const entry of timezoneData) {
      const countryId = countryMap.get(entry.country)
      if (!countryId) {
        console.log(`   ⚠️  Country ${entry.country} not found, skipping`)
        continue
      }

      for (const zone of entry.zones) {
        const { error } = await supabase
          .from('timezone_zones')
          .upsert(
            { country_id: countryId, ...zone },
            { onConflict: 'country_id,zone_code', ignoreDuplicates: false }
          )

        if (error) {
          console.error(`   ❌ Error inserting ${entry.country} zone ${zone.zone_code}:`, error.message)
        } else {
          zoneCount++
        }
      }
    }
    console.log(`   ✅ Seeded ${zoneCount} timezone zones across ${timezoneData.length} countries`)

    console.log('\n✨ Timezone zones seeding completed!\n')

  } catch (error) {
    console.error('\n💥 Fatal error:', error)
    process.exit(1)
  }
}

seedTimezoneZones()
