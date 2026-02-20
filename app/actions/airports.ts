'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Airport, Country } from '@/types/database'
import { AIRPORT_COUNTRY } from '@/lib/data/airport-countries'
import { lookupAirportByIATA } from '@/app/actions/airport-inquiry'

export interface AirportWithCountry extends Airport {
  countries: { name: string; iso_code_2: string; flag_emoji: string | null } | null
  timezone_zones: { iana_timezone: string; zone_name: string } | null
}

export async function getAirportsWithCountry(): Promise<AirportWithCountry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airports')
    .select('*, countries(name, iso_code_2, flag_emoji), timezone_zones(iana_timezone, zone_name)')
    .order('iata_code', { ascending: true })

  if (error) {
    console.error('Error fetching airports:', error)
    return []
  }
  return (data as unknown as AirportWithCountry[]) || []
}

export async function getAirportWithCountryById(id: string): Promise<AirportWithCountry | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airports')
    .select('*, countries(name, iso_code_2, flag_emoji), timezone_zones(iana_timezone, zone_name)')
    .eq('id', id)
    .single()

  if (error) return null
  return data as unknown as AirportWithCountry
}

export async function getAirports(): Promise<Airport[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .order('icao_code', { ascending: true })

  if (error) {
    console.error('Error fetching airports:', error)
    return []
  }
  return data || []
}

const ALLOWED_FIELDS = [
  'icao_code', 'iata_code', 'name', 'city', 'country', 'country_id', 'timezone',
  'timezone_zone_id', 'latitude', 'longitude', 'elevation_ft', 'is_active',
  'longest_runway_length_m', 'longest_runway_width_m', 'ils_category', 'fire_category',
  'slot_classification', 'slot_departure_tolerance_early', 'slot_departure_tolerance_late',
  'slot_arrival_tolerance_early', 'slot_arrival_tolerance_late',
  'crew_reporting_time_minutes', 'crew_debrief_time_minutes', 'is_home_base',
  'cannot_be_used_for_diversion', 'notes', 'fuel_available', 'fuel_types',
  'airport_authority', 'operating_hours_open', 'operating_hours_close', 'is_24_hour',
  'ground_handling_agents', 'self_handling_permitted', 'slot_coordinator_contact',
  'is_crew_base', 'crew_lounge_available', 'rest_facility_available',
  'crew_positioning_reporting_minutes', 'is_etops_alternate', 'etops_diversion_minutes',
  'special_notes',
] as const

export async function updateAirportField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!ALLOWED_FIELDS.includes(field as typeof ALLOWED_FIELDS[number])) {
    return { error: 'Invalid field' }
  }

  // Enforce uppercase for code fields
  let sanitized = value
  if ((field === 'iata_code' || field === 'icao_code') && typeof value === 'string') {
    sanitized = value.toUpperCase()
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('airports')
    .update({ [field]: sanitized })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A record with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

export async function updateAirportFields(
  id: string,
  fields: Record<string, string | number | boolean | null>
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('airports')
    .update(fields)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

export async function createAirport(formData: FormData) {
  const supabase = createAdminClient()

  const airportData = {
    icao_code: formData.get('icao_code') as string,
    iata_code: formData.get('iata_code') as string || null,
    name: formData.get('airport_name') as string,
    city: formData.get('city') as string,
    country_id: formData.get('country_id') as string || null,
    timezone: formData.get('timezone') as string,
  }

  if (!airportData.icao_code || !airportData.name || !airportData.timezone) {
    return { error: 'ICAO code, name, and timezone are required' }
  }

  if (!/^[A-Z]{4}$/.test(airportData.icao_code)) {
    return { error: 'ICAO code must be exactly 4 uppercase letters' }
  }

  if (airportData.iata_code && !/^[A-Z]{3}$/.test(airportData.iata_code)) {
    return { error: 'IATA code must be exactly 3 uppercase letters' }
  }

  const { error } = await supabase.from('airports').insert(airportData)
  if (error) {
    if (error.code === '23505') return { error: 'An airport with this ICAO code already exists' }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

export async function deleteAirport(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airports').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

// ─── Fix airports missing country_id using hardcoded lookup ────────────────

export async function fixAirportCountries(): Promise<{
  fixed: number
  details: string[]
}> {
  const supabase = createAdminClient()

  // Fetch airports that are incomplete: missing country OR have placeholder ICAO (Z+IATA)
  const { data: allAirports } = await supabase
    .from('airports')
    .select('id, iata_code, icao_code, name, country_id, timezone, latitude, longitude, elevation_ft, city')

  if (!allAirports || allAirports.length === 0) return { fixed: 0, details: [] }

  const needsFix = allAirports.filter(a =>
    !a.country_id ||
    (a.iata_code && a.icao_code === `Z${a.iata_code}`) ||
    (a.iata_code && a.name === a.iata_code) ||
    a.timezone === 'UTC'
  )

  if (needsFix.length === 0) return { fixed: 0, details: [] }

  // Build ISO → country UUID map and ICAO prefix → country map
  const { data: countries } = await supabase.from('countries').select('id, iso_code_2, icao_prefix')
  const isoToCountryId = new Map<string, string>()
  const prefixToCountry = new Map<string, { id: string; iso: string }>()
  countries?.forEach(c => {
    isoToCountryId.set(c.iso_code_2, c.id)
    if (c.icao_prefix) prefixToCountry.set(c.icao_prefix, { id: c.id, iso: c.iso_code_2 })
  })

  let fixed = 0
  const details: string[] = []

  for (const airport of needsFix) {
    const updates: Record<string, string | number | boolean | null> = {}
    const hasPlaceholderIcao = airport.iata_code && airport.icao_code === `Z${airport.iata_code}`

    // If has IATA and (missing data or placeholder ICAO), look up from OurAirports
    if (airport.iata_code && (hasPlaceholderIcao || !airport.country_id || airport.timezone === 'UTC')) {
      const info = await lookupAirportByIATA(airport.iata_code)
      if (info) {
        if (hasPlaceholderIcao && info.icao_code) updates.icao_code = info.icao_code
        if (airport.name === airport.iata_code && info.name) updates.name = info.name
        if (!airport.city && info.city) updates.city = info.city
        if (!airport.latitude && info.latitude) updates.latitude = info.latitude
        if (!airport.longitude && info.longitude) updates.longitude = info.longitude
        if (!airport.elevation_ft && info.elevation_ft) updates.elevation_ft = info.elevation_ft

        // Resolve country from lookup result
        if (!airport.country_id && info.iso_country) {
          const countryId = isoToCountryId.get(info.iso_country)
          if (countryId) {
            updates.country_id = countryId
            updates.country = info.iso_country
          }
        }

        // Resolve timezone from country's timezone zones
        const resolvedCountryId = (updates.country_id as string) || airport.country_id
        if (airport.timezone === 'UTC' && resolvedCountryId) {
          const { data: zones } = await supabase
            .from('timezone_zones')
            .select('iana_timezone')
            .eq('country_id', resolvedCountryId)
            .limit(1)
          if (zones?.[0]) updates.timezone = zones[0].iana_timezone
        }
      }
    }

    // If still no country, try ICAO prefix matching
    if (!airport.country_id && !updates.country_id) {
      const icao = (updates.icao_code as string) || airport.icao_code
      if (icao) {
        const match = prefixToCountry.get(icao.slice(0, 2)) || prefixToCountry.get(icao.slice(0, 1))
        if (match) {
          updates.country_id = match.id
          updates.country = match.iso
        }
      }
      // IATA lookup table as last resort
      if (!updates.country_id && airport.iata_code) {
        const iso = AIRPORT_COUNTRY[airport.iata_code]
        if (iso) {
          const cid = isoToCountryId.get(iso)
          if (cid) { updates.country_id = cid; updates.country = iso }
        }
      }
    }

    if (Object.keys(updates).length === 0) continue

    const { error } = await supabase
      .from('airports')
      .update(updates)
      .eq('id', airport.id)

    if (!error) {
      fixed++
      const label = airport.iata_code || airport.icao_code
      const changes = Object.keys(updates).join(', ')
      details.push(`${label}: ${changes}`)
    }
  }

  if (fixed > 0) {
    revalidatePath('/admin/master-database/airports')
  }

  return { fixed, details }
}
