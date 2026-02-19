'use client'

import { Puzzle } from 'lucide-react'

export default function AddonConfigPage() {
  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      <div className="animate-fade-in px-1">
        <h1 className="text-xl font-semibold tracking-tight">Addon Config</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Addon module management and marketplace
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
        <div className="p-3 rounded-xl bg-primary/10 text-primary mb-4">
          <Puzzle className="h-6 w-6" />
        </div>
        <p className="text-sm text-muted-foreground">
          Addon marketplace coming soon
        </p>
      </div>
    </div>
  )
}
