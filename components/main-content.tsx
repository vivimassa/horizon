'use client'

import { useUserPreferences } from '@/hooks/use-user-preferences'
import { ZoomTransition } from '@/components/navigation/zoom-transition'
import { cn } from '@/lib/utils'

export function MainContent({ children }: { children: React.ReactNode }) {
  const { preferences, isLoaded } = useUserPreferences()
  const dockPos = preferences.dock_position

  return (
    <main
      className={cn(
        'flex-1 overflow-hidden px-3 py-2',
        dockPos === 'left' && 'pl-[112px]',
        dockPos === 'bottom' && 'pb-[100px]',
        dockPos === 'top' && 'pt-[72px]',
      )}
      style={{ opacity: isLoaded ? 1 : 0, transition: 'opacity 150ms' }}
    >
      <ZoomTransition>{children}</ZoomTransition>
    </main>
  )
}
