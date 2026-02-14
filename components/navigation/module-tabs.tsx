'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Settings, Wrench, FileText } from 'lucide-react'
import { getModuleByRoute } from '@/lib/modules/registry'

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

  const isActive = (tabId: string) => {
    const tabPath = `${moduleBase}/${tabId}`
    return pathname === tabPath || pathname.startsWith(`${tabPath}/`)
  }

  return (
    <div className="mb-6">
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
    </div>
  )
}
