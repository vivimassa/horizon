import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { FlightServiceTypesTable } from '@/components/admin/flight-service-types-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function FlightServiceTypesPage() {
  const serviceTypes = await getFlightServiceTypes()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Flight Service Types</CardTitle>
          <CardDescription>
            Manage flight service type codes (J, C, F, G, P) with display colors for schedule visualization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FlightServiceTypesTable serviceTypes={serviceTypes} />
        </CardContent>
      </Card>
    </div>
  )
}
