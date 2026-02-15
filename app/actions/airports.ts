'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Airport, Country } from '@/types/database'

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

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('airports')
    .update({ [field]: value })
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
