'use client'

import { useState, useEffect, useCallback } from 'react'

export type DockPosition = 'bottom' | 'left' | 'top'
export type ThemePreference = 'light' | 'dark' | 'system'
export type ColorScheme = 'ocean' | 'violet' | 'ruby' | 'amber' | 'teal'

export interface DashboardShortcut {
  code: string
  icon?: string
  order: number
}

export interface UserPreferences {
  theme: ThemePreference
  dock_position: DockPosition
  dashboard_layout: DashboardShortcut[]
  color_scheme: ColorScheme
  avatar_url: string
}

const STORAGE_KEY = 'horizon-user-preferences'
const SYNC_EVENT = 'horizon-preferences-sync'

const DEFAULT_SHORTCUTS: DashboardShortcut[] = [
  { code: '1.1.1', order: 0 },
  { code: '2.1.2', order: 1 },
  { code: '3.1.1', order: 2 },
  { code: '3.1.3', order: 3 },
  { code: '4.2.2', order: 4 },
]

const defaultPreferences: UserPreferences = {
  theme: 'system',
  dock_position: 'bottom',
  dashboard_layout: DEFAULT_SHORTCUTS,
  color_scheme: 'ocean',
  avatar_url: '',
}

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        setPreferences({ ...defaultPreferences, ...parsed })
      }
    } catch {
      // ignore parse errors
    }
    setIsLoaded(true)
  }, [])

  // Listen for sync events from other hook instances in the same tab
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<UserPreferences>).detail
      if (detail) {
        setPreferences(detail)
      }
    }
    window.addEventListener(SYNC_EVENT, handler)
    return () => window.removeEventListener(SYNC_EVENT, handler)
  }, [])

  const updatePreferences = useCallback((updates: Partial<UserPreferences>) => {
    setPreferences(prev => {
      const next = { ...prev, ...updates }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore storage errors
      }
      // Notify other hook instances in the same tab
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }))
      return next
    })
  }, [])

  return { preferences, updatePreferences, isLoaded }
}
