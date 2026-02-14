import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Database, Users, Settings, FileText, Building2, Shield, Boxes } from 'lucide-react'

export default function AdminControlPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <Database className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Master Database</CardTitle>
            <CardDescription>
              Manage airports, aircraft, airlines, countries, and routes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/master-database/airports">Airports</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/master-database/countries">Countries</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/master-database/aircraft-types">Aircraft Types</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/master-database/airlines">Airlines</Link>
              </Button>
              <Button asChild className="w-full" variant="outline">
                <Link href="/admin/master-database/city-pairs">City Pairs</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <Users className="h-8 w-8 text-primary mb-2" />
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage operators and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <Settings className="h-8 w-8 text-primary mb-2" />
            <CardTitle>System Settings</CardTitle>
            <CardDescription>
              Configure system-wide settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <FileText className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Audit Logs</CardTitle>
            <CardDescription>
              View system activity and audit trails
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled className="w-full">
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-2xl font-bold tracking-tight mt-8 mb-4">System</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <Building2 className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Operator Profile</CardTitle>
            <CardDescription>
              Company information and settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/system/operator-profile">Manage Profile</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <Shield className="h-8 w-8 text-primary mb-2" />
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Manage users, roles, and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/system/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <Boxes className="h-8 w-8 text-primary mb-2" />
            <CardTitle>Module Management</CardTitle>
            <CardDescription>
              Enable/disable system modules
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/admin/system/modules">Manage Modules</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
