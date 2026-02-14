import { getServiceTypes } from '@/app/actions/service-types'
import { ServiceTypesTable } from '@/components/admin/service-types-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ServiceTypesPage() {
  const serviceTypes = await getServiceTypes()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Service Types</CardTitle>
          <CardDescription>
            Manage IATA service type codes and their display properties.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceTypesTable serviceTypes={serviceTypes} />
        </CardContent>
      </Card>
    </div>
  )
}
