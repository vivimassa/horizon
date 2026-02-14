import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { ScheduleGrid } from '@/components/network/schedule-grid'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ScheduleGridPage() {
  const [seasons, aircraftTypes, flightServiceTypes] = await Promise.all([
    getScheduleSeasons(),
    getAircraftTypes(),
    getFlightServiceTypes(),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Grid</CardTitle>
        <CardDescription>
          Visual overview of the weekly schedule for a season. Click any cell to edit in Schedule Builder.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScheduleGrid
          seasons={seasons}
          aircraftTypes={aircraftTypes}
          flightServiceTypes={flightServiceTypes}
        />
      </CardContent>
    </Card>
  )
}
