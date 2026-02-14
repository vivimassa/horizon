import { getCountries } from '@/app/actions/countries'
import { CountriesTable } from '@/components/admin/countries-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function CountriesPage() {
  const countries = await getCountries()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Countries</CardTitle>
          <CardDescription>
            Manage country reference data including ISO codes, regions, currencies, and ICAO prefixes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CountriesTable countries={countries} />
        </CardContent>
      </Card>
    </div>
  )
}
