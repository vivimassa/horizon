import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WorkforceReportsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workforce Reports</CardTitle>
          <CardDescription>
            Analytics for team performance and resource utilization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Workforce reports and analytics will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
