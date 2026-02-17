import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function SeasonalPlannerPage() {
  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      <div className="animate-fade-in">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Link
                href="/network/control"
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <CardTitle>1.1.6 — Seasonal Planner</CardTitle>
                <CardDescription>
                  Plan and compare seasonal schedule strategies
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Seasonal Planner will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
