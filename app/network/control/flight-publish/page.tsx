import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { FlightPublish } from '@/components/network/flight-publish'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FlightPublishPage() {
  const [seasons, aircraftTypes, flightServiceTypes] = await Promise.all([
    getScheduleSeasons(),
    getAircraftTypes(),
    getFlightServiceTypes(),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish Flights</CardTitle>
        <CardDescription>
          Instantiate schedule templates into operational flight records. Bridges Network planning to Operations execution.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FlightPublish
          seasons={seasons}
          aircraftTypes={aircraftTypes}
          flightServiceTypes={flightServiceTypes}
        />
      </CardContent>
    </Card>
  )
}
