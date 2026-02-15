import { getCityPairsWithAirports } from '@/app/actions/city-pairs'
import { CityPairsMasterDetail } from '@/components/admin/city-pairs-master-detail'
import { createClient } from '@/lib/supabase/server'

export default async function CityPairsPage() {
  const [cityPairs, supabase] = await Promise.all([
    getCityPairsWithAirports(),
    createClient(),
  ])

  const { data: aircraftTypes } = await supabase
    .from('aircraft_types')
    .select('*')
    .eq('is_active', true)
    .order('icao_type')

  const { data: airports } = await supabase
    .from('airports')
    .select('id, icao_code, iata_code, name, city, latitude, longitude, country_id, countries(name, iso_code_2, flag_emoji, region)')
    .eq('is_active', true)
    .order('iata_code')

  return (
    <CityPairsMasterDetail
      cityPairs={cityPairs}
      aircraftTypes={aircraftTypes || []}
      airports={(airports as any) || []}
    />
  )
}
