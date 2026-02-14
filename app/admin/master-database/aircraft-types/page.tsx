import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { AircraftTypesTable } from '@/components/admin/aircraft-types-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AircraftTypesPage() {
  const aircraftTypes = await getAircraftTypes()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Aircraft Types</CardTitle>
          <CardDescription>
            Manage aircraft type catalogue including ICAO codes, crew requirements, default TAT, and cabin configurations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AircraftTypesTable aircraftTypes={aircraftTypes} />
        </CardContent>
      </Card>
    </div>
  )
}
