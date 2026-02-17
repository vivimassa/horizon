import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function CodeshareManagerPage() {
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
                <CardTitle>1.1.5 — Codeshare Manager</CardTitle>
                <CardDescription>
                  Manage codeshare agreements and partner operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Codeshare Manager will be implemented here.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
