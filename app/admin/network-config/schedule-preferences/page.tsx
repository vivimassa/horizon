'use client'

import { SlidersHorizontal } from 'lucide-react'

export default function SchedulePreferencesPage() {
  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold">
        4.3.3. Schedule Preferences &amp; Restrictions
      </h1>
      <p className="text-xs text-muted-foreground mt-1">
        Define rules and constraints for aircraft tail assignment optimization
      </p>

      <div className="mt-12 flex flex-col items-center justify-center text-center">
        <div
          className="rounded-full bg-muted/30 flex items-center justify-center mb-4"
          style={{ width: 64, height: 64 }}
        >
          <SlidersHorizontal className="text-muted-foreground" style={{ width: 28, height: 28 }} />
        </div>
        <p className="font-medium" style={{ fontSize: 13 }}>
          Coming Soon
        </p>
        <p className="text-muted-foreground mt-1 max-w-md" style={{ fontSize: 11 }}>
          Configure route-to-aircraft-type rules, base station constraints,
          cycle limits, and other preferences that drive the tail assignment optimizer.
        </p>
      </div>
    </div>
  )
}
