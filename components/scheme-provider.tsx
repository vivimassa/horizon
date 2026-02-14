'use client'

import { useEffect } from 'react'
import { useUserPreferences } from '@/hooks/use-user-preferences'

export function SchemeProvider({ children }: { children: React.ReactNode }) {
  const { preferences, isLoaded } = useUserPreferences()

  useEffect(() => {
    if (isLoaded) {
      document.documentElement.dataset.scheme = preferences.color_scheme
    }
  }, [preferences.color_scheme, isLoaded])

  return <>{children}</>
}
