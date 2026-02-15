'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { Dock } from '@/components/navigation/dock'
import { OperatorWithRole } from '@/lib/operators'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Home,
  Network,
  Cog,
  Users,
  FileText,
  Shield,
  MoreHorizontal,
  X,
} from 'lucide-react'
import { HorizonLogo } from '@/components/horizon-logo'

interface ResponsiveDockProps {
  operator: OperatorWithRole | null
  accessibleModules: string[]
}

const modules = [
  { id: 'home', label: 'Home', icon: Home, path: '/' },
  { id: 'network', label: 'Network', icon: Network, path: '/network' },
  { id: 'operations', label: 'Operations', icon: Cog, path: '/operations' },
  { id: 'workforce', label: 'Workforce', icon: Users, path: '/workforce' },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { id: 'admin', label: 'Admin', icon: Shield, path: '/admin' },
]

const MAX_MOBILE_ITEMS = 5

export function ResponsiveDock({ operator, accessibleModules }: ResponsiveDockProps) {
  const breakpoint = useBreakpoint()
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)
  const { preferences } = useUserPreferences()
  const dockPosition = preferences.dock_position

  // Hide on auth pages
  if (pathname === '/login' || pathname === '/register') return null

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const hasAccess = (moduleId: string) => accessibleModules.includes(moduleId)

  // Desktop: render the original Dock as-is
  if (breakpoint === 'desktop') {
    return <Dock operator={operator} accessibleModules={accessibleModules} dockPosition={dockPosition} />
  }

  // Tablet: icons-only dock, always bottom-positioned
  if (breakpoint === 'tablet') {
    return (
      <div className="fixed z-50 bottom-12 left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-3xl p-2 glass-float">
          {/* Logo */}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className="flex items-center justify-center rounded-2xl transition-all duration-300 bg-gradient-to-br from-primary to-primary/85 hover:scale-105 hover:shadow-glass-glow backdrop-blur-sm h-11 w-11 p-1.5"
                >
                  <HorizonLogo variant="dock" dockPosition="left" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top" className="glass-heavy rounded-xl">
                <p className="font-medium">HORIZON</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="h-10 w-px bg-border mx-0.5" />

          {/* Module Icons (no labels) */}
          <TooltipProvider delayDuration={200}>
            <div className="flex gap-1">
              {modules.map((module) => {
                const Icon = module.icon
                const active = isActive(module.path)
                const accessible = hasAccess(module.id)

                return (
                  <Tooltip key={module.id}>
                    <TooltipTrigger asChild>
                      {accessible ? (
                        <Link
                          href={module.path}
                          className={cn(
                            'flex items-center justify-center rounded-2xl transition-all duration-300',
                            'w-11 h-11',
                            'hover:scale-105',
                            active
                              ? 'bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.12)]'
                              : 'text-muted-foreground hover:bg-white/40 dark:hover:bg-white/10 hover:text-foreground'
                          )}
                        >
                          <Icon className={cn('h-5 w-5', active && 'drop-shadow-sm')} />
                        </Link>
                      ) : (
                        <div className="flex items-center justify-center rounded-2xl w-11 h-11 text-muted-foreground/30 cursor-not-allowed">
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="glass-heavy rounded-xl">
                      <p>{module.label}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    )
  }

  // Mobile: bottom tab bar
  const accessibleItems = modules.filter((m) => hasAccess(m.id))
  const visibleItems = accessibleItems.slice(0, MAX_MOBILE_ITEMS)
  const overflowItems = accessibleItems.slice(MAX_MOBILE_ITEMS)
  const hasOverflow = overflowItems.length > 0

  // If we have overflow, the last visible slot becomes "More"
  const displayItems = hasOverflow ? visibleItems.slice(0, MAX_MOBILE_ITEMS - 1) : visibleItems

  return (
    <>
      <div className="fixed z-50 bottom-6 left-0 right-0 px-3">
        <div className="glass-float rounded-2xl px-2 py-1 safe-bottom">
          <div className="flex items-center justify-around">
            {displayItems.map((module) => {
              const Icon = module.icon
              const active = isActive(module.path)
              return (
                <Link
                  key={module.id}
                  href={module.path}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] min-w-[44px] rounded-xl transition-all duration-200 flex-1',
                    active
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'drop-shadow-sm')} />
                  <span className={cn(
                    'text-[10px] font-medium leading-none',
                    active && 'font-semibold'
                  )}>
                    {module.label}
                  </span>
                </Link>
              )
            })}

            {hasOverflow && (
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] min-w-[44px] rounded-xl transition-all duration-200 flex-1',
                  moreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {moreOpen ? <X className="h-5 w-5" /> : <MoreHorizontal className="h-5 w-5" />}
                <span className="text-[10px] font-medium leading-none">More</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* More overflow popover */}
      {moreOpen && hasOverflow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
          <div className="fixed z-50 bottom-24 left-3 right-3 animate-fade-up">
            <div className="glass-heavy rounded-2xl p-3 space-y-1">
              {overflowItems.map((module) => {
                const Icon = module.icon
                const active = isActive(module.path)
                return (
                  <Link
                    key={module.id}
                    href={module.path}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 min-h-[44px]',
                      active
                        ? 'bg-primary/15 text-primary'
                        : 'text-foreground hover:bg-white/50 dark:hover:bg-white/10'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{module.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}
    </>
  )
}
