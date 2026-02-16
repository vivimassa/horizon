import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAirports } from '@/app/actions/airports'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { getCityPairsForScheduleBuilder } from '@/app/actions/city-pairs'
import { getAllTatRules } from '@/app/actions/airport-tat-rules'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { ScheduleBuilder } from '@/components/network/schedule-builder'

export default async function ScheduleGridPage() {
  const [seasons, aircraftTypes, airports, flightServiceTypes, cpData, tatRules, operator] =
    await Promise.all([
      getScheduleSeasons(),
      getAircraftTypes(),
      getAirports(),
      getFlightServiceTypes(),
      getCityPairsForScheduleBuilder(),
      getAllTatRules(),
      getOperatorProfile(),
    ])

  return (
    <ScheduleBuilder
      readOnly
      seasons={seasons}
      aircraftTypes={aircraftTypes}
      airports={airports}
      flightServiceTypes={flightServiceTypes}
      cityPairs={cpData.pairs}
      blockLookup={cpData.blockLookup}
      tatRules={tatRules}
      operatorIataCode={operator?.iata_code || ''}
      operatorTimezone={operator?.timezone}
    />
  )
}
