import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAirports } from '@/app/actions/airports'
import { getRouteTemplates } from '@/app/actions/aircraft-routes'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { getCityPairsForScheduleBuilder } from '@/app/actions/city-pairs'
import { getScenarios } from '@/app/actions/scenarios'
import { AircraftRoutesBuilder } from '@/components/network/aircraft-routes-builder'

export default async function ScheduleBuilderPage() {
  const [seasons, aircraftTypes, airports, operator, initialTemplates, cpData, scenarios] = await Promise.all([
    getScheduleSeasons(),
    getAircraftTypes(),
    getAirports(),
    getOperatorProfile(),
    getRouteTemplates(),
    getCityPairsForScheduleBuilder(),
    getScenarios(),
  ])

  return (
    <AircraftRoutesBuilder
      seasons={seasons}
      aircraftTypes={aircraftTypes}
      airports={airports}
      initialRoutes={[]}
      initialUnassignedCount={0}
      operatorIataCode={operator?.iata_code || 'VJ'}
      initialTemplates={initialTemplates}
      blockLookup={cpData.blockLookup}
      scenarios={scenarios}
    />
  )
}
