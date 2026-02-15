'use client'

import { useState, useEffect, useCallback } from 'react'

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

const BREAKPOINTS = {
  tablet: '(min-width: 768px)',
  desktop: '(min-width: 1025px)',
} as const

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>('desktop')

  const calculate = useCallback(() => {
    if (window.matchMedia(BREAKPOINTS.desktop).matches) return 'desktop'
    if (window.matchMedia(BREAKPOINTS.tablet).matches) return 'tablet'
    return 'mobile'
  }, [])

  useEffect(() => {
    setBreakpoint(calculate())

    const desktopMql = window.matchMedia(BREAKPOINTS.desktop)
    const tabletMql = window.matchMedia(BREAKPOINTS.tablet)

    const handler = () => setBreakpoint(calculate())

    desktopMql.addEventListener('change', handler)
    tabletMql.addEventListener('change', handler)

    return () => {
      desktopMql.removeEventListener('change', handler)
      tabletMql.removeEventListener('change', handler)
    }
  }, [calculate])

  return breakpoint
}

export function useIsMobile() {
  return useBreakpoint() === 'mobile'
}

export function useIsTablet() {
  return useBreakpoint() === 'tablet'
}

export function useIsDesktop() {
  return useBreakpoint() === 'desktop'
}
