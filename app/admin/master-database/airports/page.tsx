import { getAirports } from '@/app/actions/airports'
import { AirportsTable } from '@/components/admin/airports-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AirportsPage() {
  const airports = await getAirports()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Airports</CardTitle>
          <CardDescription>
            Manage airport reference data including ICAO codes, IATA codes, and timezones.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AirportsTable airports={airports} />
        </CardContent>
      </Card>
    </div>
  )
}
