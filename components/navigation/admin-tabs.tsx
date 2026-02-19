'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  Settings,
  Database,
  Network,
  Cog,
  Users,
  Puzzle,
} from 'lucide-react'
import { getModuleByRoute } from '@/lib/modules/registry'
import { ModuleBreadcrumb, resolveModule } from './module-breadcrumb'

const tabs = [
  { id: 'system', label: 'System', icon: Settings },
  { id: 'master-database', label: 'Master DB', icon: Database },
  { id: 'network-config', label: 'Network', icon: Network },
  { id: 'operations-config', label: 'Ops', icon: Cog },
  { id: 'workforce-config', label: 'Workforce', icon: Users },
  { id: 'addon-config', label: 'Addons', icon: Puzzle },
]

export function AdminTabs() {
  const pathname = usePathname()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLAnchorElement>(null)
  const [activeLeft, setActiveLeft] = useState(0)

  const isActive = (tabId: string) => {
    const tabPath = `/admin/${tabId}`
    return pathname === tabPath || pathname.startsWith(`${tabPath}/`)
  }

  // Find the deepest leaf module for the current path
  const currentModule = resolveModule(pathname)

  // Measure the active tab's left edge relative to the wrapper
  useEffect(() => {
    const measure = () => {
      if (activeTabRef.current && wrapperRef.current) {
        const tabRect = activeTabRef.current.getBoundingClientRect()
        const wrapperRect = wrapperRef.current.getBoundingClientRect()
        setActiveLeft(tabRect.left - wrapperRect.left + tabRect.width / 2)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [pathname])

  return (
    <div ref={wrapperRef} className={currentModule ? '' : 'mb-4'}>
      <div className={cn(
        'inline-flex items-center gap-1 p-1 rounded-full',
        'glass'
      )}>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.id)
          const path = `/admin/${tab.id}`
          const mod = getModuleByRoute(path)
          const codePrefix = mod ? `${mod.code} ` : ''

          return (
            <Link
              key={tab.id}
              href={path}
              ref={active ? activeTabRef : undefined}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-300',
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{codePrefix}{tab.label}</span>
            </Link>
          )
        })}
      </div>

      {currentModule && (
        <ModuleBreadcrumb leftOffset={activeLeft} module={currentModule} />
      )}
    </div>
  )
}
