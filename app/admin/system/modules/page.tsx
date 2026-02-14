import { getModuleDefinitions } from '@/app/actions/modules'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { ModuleManagement } from '@/components/admin/module-management'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ModulesPage() {
  const [modules, profile] = await Promise.all([
    getModuleDefinitions(),
    getOperatorProfile()
  ])

  if (!profile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Module Management</CardTitle>
            <CardDescription>Operator profile not found</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Module Management</CardTitle>
          <CardDescription>
            Enable or disable system modules. Some modules have dependencies that must be enabled first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModuleManagement modules={modules} enabledModules={profile.enabled_modules} />
        </CardContent>
      </Card>
    </div>
  )
}
