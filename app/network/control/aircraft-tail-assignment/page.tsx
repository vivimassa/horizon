'use client'

import { Plane } from 'lucide-react'

export default function AircraftTailAssignmentPage() {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center">
          <Plane className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Aircraft Tail Assignment Optimizer</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated tail assignment optimization — coming soon.
          </p>
        </div>
      </div>
    </div>
  )
}
