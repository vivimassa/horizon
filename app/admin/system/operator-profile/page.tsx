import { getOperatorProfile } from '@/app/actions/operator-profile'
import { OperatorProfileForm } from '@/components/admin/operator-profile-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2 } from 'lucide-react'

export default async function OperatorProfilePage() {
  const profile = await getOperatorProfile()

  if (!profile) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Operator Profile</CardTitle>
            <CardDescription>
              Company profile not found. Please contact support.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Operator Profile</h2>
            <p className="text-muted-foreground">Company information and settings</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Name</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{profile.name}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identifiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="text-sm text-muted-foreground">ICAO:</span>{' '}
                <span className="font-mono font-semibold">{profile.code || '—'}</span>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">IATA:</span>{' '}
                <span className="font-mono font-semibold">{profile.iata_code || '—'}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enabled Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {profile.enabled_modules.map(module => (
                <Badge key={module} variant="secondary" className="text-xs">
                  {module}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>
            Update your company profile and operational settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OperatorProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  )
}
