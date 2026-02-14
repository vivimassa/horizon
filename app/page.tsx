import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOperator } from '@/lib/operators'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Network, Cog, Users, FileText, ArrowRight, Calendar } from 'lucide-react'

const moduleCards = [
  {
    id: 'network',
    label: 'Network',
    description: 'Route management, airports, and fleet infrastructure',
    icon: Network,
    href: '/network/control',
  },
  {
    id: 'operations',
    label: 'Operations',
    description: 'Flight operations, scheduling, and dispatch',
    icon: Cog,
    href: '/operations/control',
  },
  {
    id: 'workforce',
    label: 'Workforce',
    description: 'Crew management, rostering, and personnel',
    icon: Users,
    href: '/workforce/control',
  },
  {
    id: 'reports',
    label: 'Reports',
    description: 'Analytics, insights, and operational reports',
    icon: FileText,
    href: '/reports/control',
  },
]

function formatDate(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = date.getDate().toString().padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If not authenticated, redirect to login
  if (!user) {
    redirect('/login')
  }

  const operator = await getCurrentOperator()
  const profile = await getOperatorProfile()

  // Get enabled modules from profile
  const enabledModules = profile?.enabled_modules || []

  // Format today's date
  const today = new Date()
  const formattedDate = formatDate(today)

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Welcome back, {operator?.full_name || user.email?.split('@')[0]}
          </h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="text-lg">{formattedDate}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-sm">
            {operator?.role?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Operator'}
          </Badge>
          <form action={signOut}>
            <Button variant="outline" type="submit">
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      {/* Company Info Bar */}
      {profile && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <h2 className="text-xl font-semibold">{profile.name}</h2>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                {profile.code && (
                  <span className="font-mono font-semibold">
                    ICAO: {profile.code}
                  </span>
                )}
                {profile.iata_code && (
                  <span className="font-mono font-semibold">
                    IATA: {profile.iata_code}
                  </span>
                )}
                <span>{profile.country}</span>
                <span className="font-mono text-xs">
                  {profile.timezone}
                </span>
              </div>
            </div>
            <Badge variant="secondary">
              {enabledModules.length} modules enabled
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* Module Cards */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Modules</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {moduleCards.map((module) => {
            const Icon = module.icon
            const isEnabled = enabledModules.includes(module.id)

            return (
              <Card
                key={module.id}
                className={isEnabled ? 'hover:shadow-md transition-shadow' : 'opacity-60'}
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-3 rounded-lg ${isEnabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    {!isEnabled && (
                      <Badge variant="secondary" className="text-xs">
                        Not activated
                      </Badge>
                    )}
                  </div>
                  <CardTitle className={isEnabled ? '' : 'text-muted-foreground'}>
                    {module.label}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {module.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isEnabled ? (
                    <Button asChild className="w-full group">
                      <Link href={module.href}>
                        Open Module
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  ) : (
                    <Button disabled className="w-full">
                      Module Disabled
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Quick Stats (if needed) */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {enabledModules.filter(m => ['network', 'operations', 'workforce', 'reports'].includes(m)).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Core operational modules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Role</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {operator?.role?.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Access level: {operator?.status || 'Active'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              <span className="text-2xl font-bold">Operational</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              All systems running normally
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
