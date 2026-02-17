import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { getScenarios } from '@/app/actions/scenarios'
import { ScheduleGrid } from '@/components/network/schedule-grid'

export default async function ScheduleGridPage() {
  const [seasons, aircraftTypes, flightServiceTypes, scenarios] =
    await Promise.all([
      getScheduleSeasons(),
      getAircraftTypes(),
      getFlightServiceTypes(),
      getScenarios(),
    ])

  return (
    <ScheduleGrid
      seasons={seasons}
      aircraftTypes={aircraftTypes}
      flightServiceTypes={flightServiceTypes}
      scenarios={scenarios}
    />
  )
}
