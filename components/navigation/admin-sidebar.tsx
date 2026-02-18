'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { getModuleByRoute } from '@/lib/modules/registry'

interface SidebarSection {
  title: string
  route: string
  items: {
    label: string
    href: string
  }[]
}

const sidebarSections: SidebarSection[] = [
  {
    title: 'System',
    route: '/admin/system',
    items: [
      { label: 'Operator Profile', href: '/admin/system/operator-profile' },
      { label: 'User Management', href: '/admin/system/users' },
      { label: 'Module Management', href: '/admin/system/modules' },
      { label: 'Notification Settings', href: '/admin/system/notifications' },
      { label: 'Integration Settings', href: '/admin/system/integrations' },
    ],
  },
  {
    title: 'Master Database',
    route: '/admin/master-database',
    items: [
      { label: 'Countries', href: '/admin/master-database/countries' },
      { label: 'Airports', href: '/admin/master-database/airports' },
      { label: 'Aircraft Types', href: '/admin/master-database/aircraft-types' },
      { label: 'Aircraft Registrations', href: '/admin/master-database/aircraft-registrations' },
      { label: 'Airlines', href: '/admin/master-database/airlines' },
      { label: 'City Pairs', href: '/admin/master-database/city-pairs' },
      { label: 'Flight Service Types', href: '/admin/master-database/flight-service-types' },
      { label: 'Delay Codes', href: '/admin/master-database/delay-codes' },
      { label: 'Cabin Classes', href: '/admin/master-database/cabin-classes' },
      { label: 'Units of Measure', href: '/admin/master-database/units-of-measure' },
    ],
  },
  {
    title: 'Network Config',
    route: '/admin/network-config',
    items: [
      { label: 'Schedule Seasons', href: '/admin/network-config/schedule-seasons' },
      { label: 'Codeshare Config', href: '/admin/network-config/codeshare-config' },
      { label: 'Schedule Preferences & Restrictions', href: '/admin/network-config/schedule-preferences' },
    ],
  },
  {
    title: 'Operations Config',
    route: '/admin/operations-config',
    items: [
      { label: 'Flight Status Rules', href: '/admin/operations-config/flight-status-rules' },
      { label: 'Diversion Airports', href: '/admin/operations-config/diversion-airports' },
      { label: 'Ground Time Rules', href: '/admin/operations-config/ground-time-rules' },
      { label: 'Alert Thresholds', href: '/admin/operations-config/alert-thresholds' },
      { label: 'Message Configuration', href: '/admin/operations-config/message-config' },
      { label: 'OCC Desk Configuration', href: '/admin/operations-config/occ-desk-config' },
      { label: 'Maintenance Types', href: '/admin/operations-config/maintenance-types' },
    ],
  },
  {
    title: 'Workforce Config',
    route: '/admin/workforce-config',
    items: [
      { label: 'Crew Ranks', href: '/admin/workforce-config/crew-ranks' },
      { label: 'Crew Bases', href: '/admin/workforce-config/crew-bases' },
      { label: 'Qualification Types', href: '/admin/workforce-config/qualification-types' },
      { label: 'Activity Codes', href: '/admin/workforce-config/activity-codes' },
      { label: 'FDTL Rule Sets', href: '/admin/workforce-config/fdtl-rule-sets' },
      { label: 'FDTL Rule Advisor', href: '/admin/workforce-config/fdtl-rule-advisor' },
      { label: 'Roster Rules', href: '/admin/workforce-config/roster-rules' },
      { label: 'Crew Groups', href: '/admin/workforce-config/crew-groups' },
      { label: 'Request Types', href: '/admin/workforce-config/request-types' },
      { label: 'Seniority Rules', href: '/admin/workforce-config/seniority-rules' },
    ],
  },
  {
    title: 'Addon Config',
    route: '/admin/addon-config',
    items: [
      { label: 'Addons Overview', href: '/admin/addon-config' },
    ],
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleSection = (title: string) => {
    setCollapsed(prev => ({ ...prev, [title]: !prev[title] }))
  }

  const isItemActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const isSectionActive = (section: SidebarSection) => {
    return section.items.some(item => isItemActive(item.href))
  }

  return (
    <aside className={cn(
      'w-64 shrink-0 rounded-2xl p-4',
      'glass',
      'h-full overflow-y-auto',
      'custom-scrollbar'
    )}>
      <div className="space-y-1">
        {/* Dashboard link */}
        <Link
          href="/admin/control"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
            pathname === '/admin/control' || pathname === '/admin'
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10'
          )}
        >
          Dashboard
        </Link>

        {/* Sections */}
        {sidebarSections.map((section) => {
          const isCollapsed = collapsed[section.title] ?? false
          const sectionActive = isSectionActive(section)
          const sectionMod = getModuleByRoute(section.route)
          const sectionCode = sectionMod ? `${sectionMod.code} ` : ''

          return (
            <div key={section.title} className="pt-2">
              <button
                onClick={() => toggleSection(section.title)}
                className={cn(
                  'flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors',
                  sectionActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span>{sectionCode}{section.title}</span>
                <ChevronDown className={cn(
                  'h-3 w-3 transition-transform duration-200',
                  isCollapsed && '-rotate-90'
                )} />
              </button>

              {!isCollapsed && (
                <div className="mt-1 space-y-0.5">
                  {section.items.map((item) => {
                    const active = isItemActive(item.href)
                    const itemMod = getModuleByRoute(item.href)
                    const itemCode = itemMod ? `${itemMod.code} ` : ''
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'block px-3 py-1.5 text-sm rounded-lg transition-all duration-200',
                          active
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/10'
                        )}
                      >
                        <span className="font-mono text-xs opacity-60">{itemCode}</span>{item.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
