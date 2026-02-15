'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { AdminSidebar } from '@/components/navigation/admin-sidebar'
import { getModuleByRoute } from '@/lib/modules/registry'
import {
  ChevronDown,
  Menu,
  X,
  Settings,
  Database,
  Network,
  Cog,
  Users,
  Puzzle,
} from 'lucide-react'

interface SidebarSection {
  title: string
  route: string
  icon: React.ComponentType<{ className?: string }>
  items: { label: string; href: string }[]
}

const sidebarSections: SidebarSection[] = [
  {
    title: 'System',
    route: '/admin/system',
    icon: Settings,
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
    icon: Database,
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
    ],
  },
  {
    title: 'Network Config',
    route: '/admin/network-config',
    icon: Network,
    items: [
      { label: 'Schedule Seasons', href: '/admin/network-config/schedule-seasons' },
      { label: 'Codeshare Config', href: '/admin/network-config/codeshare-config' },
      { label: 'Route Constraints', href: '/admin/network-config/route-constraints' },
      { label: 'SSIM Configuration', href: '/admin/network-config/ssim-config' },
    ],
  },
  {
    title: 'Operations Config',
    route: '/admin/operations-config',
    icon: Cog,
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
    icon: Users,
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
    icon: Puzzle,
    items: [
      { label: 'Addons Overview', href: '/admin/addon-config' },
    ],
  },
]

export function ResponsiveAdminSidebar() {
  const breakpoint = useBreakpoint()
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tabletExpandedSection, setTabletExpandedSection] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const overlayRef = useRef<HTMLDivElement>(null)

  const isItemActive = (href: string) => pathname === href || pathname.startsWith(href + '/')
  const isSectionActive = (section: SidebarSection) => section.items.some((item) => isItemActive(item.href))

  // Close drawer on navigation
  useEffect(() => {
    setDrawerOpen(false)
    setTabletExpandedSection(null)
  }, [pathname])

  // Close tablet overlay on outside click / Escape
  useEffect(() => {
    if (!tabletExpandedSection) return
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setTabletExpandedSection(null)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTabletExpandedSection(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [tabletExpandedSection])

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [drawerOpen])

  const toggleCollapsed = (title: string) => {
    setCollapsed((prev) => ({ ...prev, [title]: !prev[title] }))
  }

  // Desktop: render original AdminSidebar
  if (breakpoint === 'desktop') {
    return <AdminSidebar />
  }

  // Tablet: icon strip + expandable overlay
  if (breakpoint === 'tablet') {
    return (
      <div className="relative shrink-0">
        {/* Icon strip */}
        <div className="w-14 glass rounded-2xl p-2 flex flex-col items-center gap-1 sticky top-4 h-fit">
          {/* Dashboard icon */}
          <Link
            href="/admin/control"
            className={cn(
              'w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200',
              pathname === '/admin/control' || pathname === '/admin'
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10'
            )}
          >
            <Menu className="h-5 w-5" />
          </Link>

          <div className="h-px w-8 bg-border my-1" />

          {/* Section icons */}
          {sidebarSections.map((section) => {
            const Icon = section.icon
            const active = isSectionActive(section)
            const expanded = tabletExpandedSection === section.title

            return (
              <button
                key={section.title}
                onClick={() => setTabletExpandedSection(expanded ? null : section.title)}
                className={cn(
                  'w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200',
                  active || expanded
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10'
                )}
                title={section.title}
              >
                <Icon className="h-5 w-5" />
              </button>
            )
          })}
        </div>

        {/* Expanded section overlay */}
        {tabletExpandedSection && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden />
            <div
              ref={overlayRef}
              className="absolute left-16 top-0 w-64 z-20 glass-heavy rounded-2xl p-4 animate-scale-up"
            >
              {(() => {
                const section = sidebarSections.find((s) => s.title === tabletExpandedSection)
                if (!section) return null
                const sectionMod = getModuleByRoute(section.route)
                const sectionCode = sectionMod ? `${sectionMod.code} ` : ''

                return (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {sectionCode}{section.title}
                      </h3>
                      <button
                        onClick={() => setTabletExpandedSection(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/50 dark:hover:bg-white/10"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const active = isItemActive(item.href)
                        const itemMod = getModuleByRoute(item.href)
                        const itemCode = itemMod ? `${itemMod.code} ` : ''
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              'block px-3 py-2 text-sm rounded-lg transition-all duration-200 min-h-[44px] flex items-center',
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
                  </>
                )
              })()}
            </div>
          </>
        )}
      </div>
    )
  }

  // Mobile: hamburger button + full-screen slide-out drawer
  return (
    <>
      {/* Hamburger trigger */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="fixed top-4 left-4 z-40 w-11 h-11 flex items-center justify-center rounded-xl glass-float transition-all duration-200 hover:scale-105 md:hidden"
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300',
          drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-[85vw] max-w-xs glass-heavy transition-transform duration-300 ease-out overflow-y-auto scrollbar-thin',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">Admin</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer content */}
        <div className="p-4 space-y-1">
          {/* Dashboard */}
          <Link
            href="/admin/control"
            className={cn(
              'flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 min-h-[44px]',
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
            const Icon = section.icon

            return (
              <div key={section.title} className="pt-2">
                <button
                  onClick={() => toggleCollapsed(section.title)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors min-h-[44px]',
                    sectionActive
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {sectionCode}{section.title}
                  </span>
                  <ChevronDown className={cn(
                    'h-3 w-3 transition-transform duration-200',
                    isCollapsed && '-rotate-90'
                  )} />
                </button>

                {!isCollapsed && (
                  <div className="mt-1 space-y-0.5 ml-6">
                    {section.items.map((item) => {
                      const active = isItemActive(item.href)
                      const itemMod = getModuleByRoute(item.href)
                      const itemCode = itemMod ? `${itemMod.code} ` : ''
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            'block px-3 py-2.5 text-sm rounded-lg transition-all duration-200 min-h-[44px]',
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
      </div>
    </>
  )
}
