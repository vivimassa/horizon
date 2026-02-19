import { getScheduleRules } from '@/app/actions/schedule-rules'
import { SchedulePreferences } from '@/components/admin/schedule-preferences'
import { createClient } from '@/lib/supabase/server'

export default async function SchedulePreferencesPage() {
  const supabase = await createClient()

  const [rules, acTypesRes, registrationsRes, airportsRes, serviceTypesRes, countriesRes] = await Promise.all([
    getScheduleRules(),
    supabase.from('aircraft_types').select('id, icao_type, name, is_active').eq('is_active', true).order('icao_type'),
    supabase.from('aircraft_registrations').select('id, registration, aircraft_types(icao_type)').eq('is_active', true).order('registration'),
    supabase.from('airports').select('id, iata_code, name, country').order('iata_code'),
    supabase.from('flight_service_types').select('id, code, name').eq('is_active', true).order('code'),
    supabase.from('countries').select('id, iso_code_2, name, flag_emoji, is_active').eq('is_active', true).order('name'),
  ])

  return (
    <SchedulePreferences
      initialRules={rules}
      aircraftTypes={acTypesRes.data || []}
      registrations={(registrationsRes.data || []) as any}
      airports={airportsRes.data || []}
      serviceTypes={serviceTypesRes.data || []}
      countries={countriesRes.data || []}
    />
  )
}
