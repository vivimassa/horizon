'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { LiquidGlassToggle } from '@/components/ui/liquid-glass-toggle'

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="w-16 h-8" />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <LiquidGlassToggle
      checked={isDark}
      onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
    />
  )
}
