'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Settings, Wrench, FileText } from 'lucide-react'
import { getModuleByRoute } from '@/lib/modules/registry'
import { ModuleBreadcrumb, resolveModule } from './module-breadcrumb'

interface ModuleTabsProps {
  moduleBase: string
  moduleName: string
}

const tabs = [
  {
    id: 'control',
    label: 'Control',
    icon: Settings,
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileText,
  },
]

export function ModuleTabs({ moduleBase }: ModuleTabsProps) {
  const pathname = usePathname()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const activeTabRef = useRef<HTMLAnchorElement>(null)
  const [activeLeft, setActiveLeft] = useState(0)

  const isActive = (tabId: string) => {
    const tabPath = `${moduleBase}/${tabId}`
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
          const path = `${moduleBase}/${tab.id}`
          const mod = getModuleByRoute(path)
          const codePrefix = mod ? `${mod.code} ` : ''

          return (
            <Link
              key={tab.id}
              href={path}
              ref={active ? activeTabRef : undefined}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300',
                active
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10'
              )}
            >
              <Icon className="h-4 w-4" />
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
