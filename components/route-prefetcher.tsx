'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { MODULE_REGISTRY } from '@/lib/modules/registry'

interface RoutePrefetcherProps {
  accessibleModules: string[]
}

const SESSION_KEY = 'horizon_prefetched'
const MIN_DISPLAY_MS = 2800
const MAX_WAIT_MS = 8000

export function RoutePrefetcher({ accessibleModules }: RoutePrefetcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'prefetching' | 'done'>('idle')
  const [fadeOut, setFadeOut] = useState(false)
  const hasRun = useRef(false)

  const shouldShow = useCallback(() => {
    if (pathname === '/login' || pathname === '/register') return false
    try {
      return !sessionStorage.getItem(SESSION_KEY)
    } catch {
      return false
    }
  }, [pathname])

  useEffect(() => {
    if (hasRun.current) return
    if (!shouldShow()) return
    hasRun.current = true
    setVisible(true)
    setPhase('prefetching')

    const startTime = Date.now()

    const routes = MODULE_REGISTRY
      .filter(m => {
        if (!m.required_module) return true
        return accessibleModules.includes(m.required_module)
      })
      .map(m => m.route)

    const allRoutes = ['/', ...routes]
    const total = allRoutes.length
    let completed = 0

    // router.prefetch() is fire-and-forget (returns void).
    // Stagger calls and simulate progress as batches are dispatched.
    const BATCH_SIZE = 5
    const BATCH_DELAY = 120
    const prefetchAll = new Promise<void>(resolve => {
      let i = 0
      function nextBatch() {
        const batch = allRoutes.slice(i, i + BATCH_SIZE)
        for (const route of batch) {
          try { router.prefetch(route) } catch {}
        }
        completed += batch.length
        setProgress(Math.round((completed / total) * 100))
        i += BATCH_SIZE
        if (i < total) {
          setTimeout(nextBatch, BATCH_DELAY)
        } else {
          resolve()
        }
      }
      nextBatch()
    })

    const done = Promise.race([
      prefetchAll,
      new Promise(resolve => setTimeout(resolve, MAX_WAIT_MS)),
    ])

    done.then(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

      setTimeout(() => {
        setPhase('done')
        setProgress(100)

        try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}

        setTimeout(() => {
          setFadeOut(true)
          setTimeout(() => setVisible(false), 500)
        }, 400)
      }, remaining)
    })
  }, [shouldShow, accessibleModules, router])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{
        background: 'hsl(var(--background))',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 500ms ease-out',
        pointerEvents: fadeOut ? 'none' : 'auto',
      }}
    >
      {/* Same watermark style as Gantt blank state */}
      <div
        style={{
          animation: phase === 'prefetching'
            ? 'watermark-breathe 4s ease-in-out infinite'
            : 'none',
        }}
      >
        {/* Light mode */}
        <img
          src="/horizon-watermark.png"
          alt=""
          aria-hidden="true"
          className="dark:hidden select-none w-[clamp(200px,25vw,350px)] h-auto"
          style={{
            filter: 'grayscale(1) brightness(0) drop-shadow(0 1px 0 rgba(255,255,255,0.8))',
            opacity: 0.06,
            mixBlendMode: 'multiply',
          }}
          draggable={false}
        />

        {/* Dark mode */}
        <div
          className="hidden dark:block w-[clamp(200px,25vw,350px)] h-[clamp(200px,25vw,350px)]"
          style={{
            opacity: 0.1,
            background: 'hsl(var(--primary))',
            maskImage: "url('/horizon-watermark.png')",
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskImage: "url('/horizon-watermark.png')",
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
          }}
        />
      </div>

      {/* Status text — same style as Gantt "Select a period to begin" */}
      <p
        className="text-muted-foreground/60 mt-4"
        style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.01em' }}
      >
        {phase === 'done' ? 'Ready' : 'Preparing your workspace\u2026'}
      </p>

      {/* Thin progress bar */}
      <div
        className="mt-5 rounded-full overflow-hidden"
        style={{ width: 160, height: 2, background: 'hsl(var(--muted) / 0.4)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            background: 'hsl(var(--primary) / 0.5)',
            transition: 'width 300ms ease-out',
          }}
        />
      </div>
    </div>
  )
}
