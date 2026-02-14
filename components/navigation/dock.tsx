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
import { Operator } from '@/types/database'

interface DockProps {
  operator: Operator | null
  accessibleModules: string[]
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

export function Dock({ operator, accessibleModules }: DockProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(path)
  }

  const hasAccess = (moduleId: string) => {
    return accessibleModules.includes(moduleId)
  }

  const isAdminModule = (moduleId: string) => {
    return moduleId === 'admin'
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-4">
      <div className="mx-auto w-fit">
        <div className="flex items-end gap-2 rounded-2xl border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 shadow-lg">
          {/* H Logo */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/"
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-xl transition-all hover:scale-110',
                    'bg-gradient-to-br from-primary to-primary/80 text-primary-foreground',
                    'font-bold text-2xl'
                  )}
                >
                  H
                </Link>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>HORIZON</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Divider */}
          <div className="h-12 w-px bg-border" />

          {/* Module Icons */}
          <TooltipProvider>
            <div className="flex items-end gap-2">
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
                            'flex h-12 w-12 items-center justify-center rounded-xl transition-all',
                            'hover:scale-110',
                            active
                              ? 'bg-primary text-primary-foreground shadow-md scale-105'
                              : 'bg-muted hover:bg-muted/80'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </Link>
                      ) : (
                        <div
                          className={cn(
                            'flex h-12 w-12 items-center justify-center rounded-xl',
                            'bg-muted/50 text-muted-foreground/30 cursor-not-allowed'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                      )}
                    </TooltipTrigger>
                    <TooltipContent side="top">
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
    </div>
  )
}
