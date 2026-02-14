import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAirports } from '@/app/actions/airports'
import { AircraftRegistrationsTable } from '@/components/admin/aircraft-registrations-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AircraftRegistrationsPage() {
  const [aircraft, aircraftTypes, airports] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
    getAirports(),
  ])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Aircraft Registrations</CardTitle>
          <CardDescription>
            Manage individual aircraft in the fleet. Each registration is linked to an aircraft type and can override cabin configuration.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AircraftRegistrationsTable aircraft={aircraft} aircraftTypes={aircraftTypes} airports={airports} />
        </CardContent>
      </Card>
    </div>
  )
}
