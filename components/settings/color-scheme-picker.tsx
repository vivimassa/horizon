'use client'

import { cn } from '@/lib/utils'
import { useUserPreferences, type ColorScheme } from '@/hooks/use-user-preferences'
import { Check } from 'lucide-react'

const schemes: { id: ColorScheme; color: string; label: string }[] = [
  { id: 'ocean', color: '#0055FF', label: 'Ocean' },
  { id: 'violet', color: '#6B2D8B', label: 'Violet' },
  { id: 'ruby', color: '#C41E3A', label: 'Ruby' },
  { id: 'amber', color: '#B8860B', label: 'Amber' },
  { id: 'teal', color: '#008B8B', label: 'Teal' },
]

export function ColorSchemePicker() {
  const { preferences, updatePreferences } = useUserPreferences()

  return (
    <div className="flex items-center gap-3">
      {schemes.map((scheme) => {
        const active = preferences.color_scheme === scheme.id
        return (
          <button
            key={scheme.id}
            onClick={() => updatePreferences({ color_scheme: scheme.id })}
            className={cn(
              'relative w-10 h-10 rounded-full transition-all duration-200',
              'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background',
              active && 'ring-2 ring-offset-2 ring-offset-background'
            )}
            style={{
              backgroundColor: scheme.color,
              ['--tw-ring-color' as string]: scheme.color,
            }}
            title={scheme.label}
          >
            {active && (
              <Check className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow-md" />
            )}
          </button>
        )
      })}
    </div>
  )
}
