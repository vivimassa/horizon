import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAirports } from '@/app/actions/airports'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { getCityPairs } from '@/app/actions/city-pairs'
import { getAllTatRules } from '@/app/actions/airport-tat-rules'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { ScheduleBuilder } from '@/components/network/schedule-builder'

export default async function ScheduleBuilderPage() {
  const [seasons, aircraftTypes, airports, flightServiceTypes, cityPairs, tatRules, operator] =
    await Promise.all([
      getScheduleSeasons(),
      getAircraftTypes(),
      getAirports(),
      getFlightServiceTypes(),
      getCityPairs(),
      getAllTatRules(),
      getOperatorProfile(),
    ])

  return (
    <ScheduleBuilder
      seasons={seasons}
      aircraftTypes={aircraftTypes}
      airports={airports}
      flightServiceTypes={flightServiceTypes}
      cityPairs={cityPairs}
      tatRules={tatRules}
      operatorIataCode={operator?.iata_code || ''}
      operatorTimezone={operator?.timezone}
    />
  )
}
