import { getCabinConfigurations } from '@/app/actions/cabin-configurations'
import { CabinConfigurationsTable } from '@/components/admin/cabin-configurations-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function CabinConfigPage() {
  const configurations = await getCabinConfigurations()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Cabin Configurations</CardTitle>
          <CardDescription>
            Define seat configurations per aircraft type.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CabinConfigurationsTable configurations={configurations} />
        </CardContent>
      </Card>
    </div>
  )
}
