import { getAirportsWithCountry } from '@/app/actions/airports'
import { getCountries } from '@/app/actions/countries'
import { AirportsMasterDetail } from '@/components/admin/airports-master-detail'
import { createClient } from '@/lib/supabase/server'

export default async function AirportsPage() {
  const [airports, countries, supabase] = await Promise.all([
    getAirportsWithCountry(),
    getCountries(),
    createClient(),
  ])

  const { data: timezoneZones } = await supabase
    .from('timezone_zones')
    .select('*')
    .order('zone_name')

  const { data: aircraftTypes } = await supabase
    .from('aircraft_types')
    .select('*')
    .eq('is_active', true)
    .order('icao_type')

  return (
    <AirportsMasterDetail
      airports={airports}
      countries={countries}
      timezoneZones={timezoneZones || []}
      aircraftTypes={aircraftTypes || []}
    />
  )
}
