import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAirports } from '@/app/actions/airports'
import { getAircraftRoutes, getUnassignedFlightCount, getRouteTemplates } from '@/app/actions/aircraft-routes'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { getCityPairsForScheduleBuilder } from '@/app/actions/city-pairs'
import { AircraftRoutesBuilder } from '@/components/network/aircraft-routes-builder'

export default async function ScheduleBuilderPage() {
  const [seasons, aircraftTypes, airports, operator, initialTemplates, cpData] = await Promise.all([
    getScheduleSeasons(),
    getAircraftTypes(),
    getAirports(),
    getOperatorProfile(),
    getRouteTemplates(),
    getCityPairsForScheduleBuilder(),
  ])

  const defaultSeasonId = seasons[0]?.id || ''

  const [initialRoutes, initialUnassignedCount] = defaultSeasonId
    ? await Promise.all([
        getAircraftRoutes(defaultSeasonId),
        getUnassignedFlightCount(defaultSeasonId),
      ])
    : [[], 0]

  return (
    <AircraftRoutesBuilder
      seasons={seasons}
      aircraftTypes={aircraftTypes}
      airports={airports}
      initialRoutes={initialRoutes}
      initialUnassignedCount={initialUnassignedCount}
      operatorIataCode={operator?.iata_code || 'VJ'}
      initialTemplates={initialTemplates}
      blockLookup={cpData.blockLookup}
    />
  )
}
