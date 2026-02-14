import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminReportsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Admin Reports</CardTitle>
          <CardDescription>
            System analytics and audit logs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Admin reports and audit logs will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
