'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
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
} from 'lucide-react'
import { OperatorWithRole } from '@/lib/operators'
import { type DockPosition } from '@/hooks/use-user-preferences'
interface DockProps {
  operator: OperatorWithRole | null
  accessibleModules: string[]
  dockPosition?: DockPosition
}

const modules = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    path: '/',
  },
  {
    id: 'network',
    label: 'Network',
    icon: Network,
    path: '/network',
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Cog,
    path: '/operations',
  },
  {
    id: 'workforce',
    label: 'Workforce',
    icon: Users,
    path: '/workforce',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
    path: '/reports',
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: Shield,
    path: '/admin',
  },
]

export function Dock({ accessibleModules, dockPosition = 'bottom' }: DockProps) {
  const pathname = usePathname()
  const position = dockPosition

  // Hide dock on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  const hasAccess = (moduleId: string) => accessibleModules.includes(moduleId)
  const isAdminModule = (moduleId: string) => moduleId === 'admin'

  const isVertical = position === 'left'

  const containerClasses = cn(
    'fixed z-50',
    position === 'bottom' && 'bottom-12 left-1/2 -translate-x-1/2',
    position === 'left' && 'left-6 top-1/2 -translate-y-1/2',
    position === 'top' && 'top-6 left-1/2 -translate-x-1/2',
  )

  const dockClasses = cn(
    'flex items-center gap-1.5 rounded-3xl p-2.5',
    'glass-float',
    isVertical && 'flex-col',
  )

  return (
    <div className={containerClasses}>
      <div className={dockClasses}>
        {/* Module Icons */}
        <TooltipProvider delayDuration={200}>
          <div className={cn('flex gap-1', isVertical && 'flex-col')}>
            {modules.map((module) => {
              const Icon = module.icon
              const active = isActive(module.path)
              const accessible = hasAccess(module.id)
              const adminLocked = isAdminModule(module.id) && !accessible

              return (
                <Tooltip key={module.id}>
                  <TooltipTrigger asChild>
                    {accessible ? (
                      <Link
                        href={module.path}
                        className={cn(
                          'flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all duration-300',
                          'w-14 py-2',
                          'hover:scale-105',
                          active
                            ? 'bg-primary/15 text-primary shadow-[0_0_12px_hsl(var(--primary)/0.12)]'
                            : 'text-muted-foreground hover:bg-white/40 dark:hover:bg-white/10 hover:text-foreground'
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
                    ) : (
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center gap-0.5 rounded-2xl',
                          'w-14 py-2',
                          'text-muted-foreground/30 cursor-not-allowed'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px] font-medium leading-none">
                          {module.label}
                        </span>
                      </div>
                    )}
                  </TooltipTrigger>
                  <TooltipContent side={isVertical ? 'right' : 'top'} className="glass-heavy rounded-xl">
                    <p>
                      {module.label}
                      {adminLocked && ' - Administrator access required'}
                      {!accessible && !adminLocked && ' - Access restricted'}
                    </p>
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
