'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Settings, Wrench, FileText } from 'lucide-react'

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

export function ModuleTabs({ moduleBase, moduleName }: ModuleTabsProps) {
  const pathname = usePathname()

  const isActive = (tabId: string) => {
    const tabPath = `${moduleBase}/${tabId}`
    return pathname === tabPath || pathname.startsWith(`${tabPath}/`)
  }

  return (
    <div className="border-b mb-6">
      <div className="flex gap-6">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab.id)
          const path = `${moduleBase}/${tab.id}`

          return (
            <Link
              key={tab.id}
              href={path}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors',
                'hover:text-primary',
                active
                  ? 'border-primary text-primary font-medium'
                  : 'border-transparent text-muted-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
