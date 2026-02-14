import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReportsControlPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reports Control</CardTitle>
          <CardDescription>
            Configure and manage reporting parameters
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Reports control features will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
