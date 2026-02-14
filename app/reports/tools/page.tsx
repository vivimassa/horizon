import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ReportsToolsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Reports Tools</CardTitle>
          <CardDescription>
            Report generation and export tools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Report generation tools will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
