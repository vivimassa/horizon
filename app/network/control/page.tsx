'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  PenLine,
  LayoutGrid,
  GanttChart as GanttChartIcon,
  GitCompareArrows,
  SendHorizonal,
  Link2,
  CalendarClock,
  PlaneTakeoff,
  MessageSquareShare,
  FileInput,
  Search,
} from 'lucide-react'

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof PenLine
  route: string
}

interface Section {
  id: string
  title: string
  subtitle: string
  screens: Screen[]
}

const sections: Section[] = [
  {
    id: 'schedule-planning',
    title: 'Schedule Planning',
    subtitle: 'Build, review, and optimise flight schedules',
    screens: [
      { code: '1.1.1', name: 'Schedule Builder', description: 'Create and manage aircraft routes with flight legs, frequencies, and seasonal periods within planning scenarios.', icon: PenLine, route: '/network/control/schedule-builder' },
      { code: '1.1.2', name: 'Schedule Grid', description: 'Tabular view of all scheduled flights with inline editing, filtering, and bulk operations.', icon: LayoutGrid, route: '/network/control/schedule-grid' },
      { code: '1.1.3', name: 'Gantt Chart', description: 'Aircraft rotation timeline showing fleet utilization, tail assignment, and operational conflicts.', icon: GanttChartIcon, route: '/network/control/schedule-gantt' },
      { code: '1.1.4', name: 'Schedule Comparison', description: 'Compare planning scenarios side by side. Analyse differences in utilization, block hours, frequencies, and coverage.', icon: GitCompareArrows, route: '/network/control/schedule-comparison' },
    ],
  },
  {
    id: 'schedule-administration',
    title: 'Schedule Administration',
    subtitle: 'Publish schedules and manage compliance',
    screens: [
      { code: '1.1.5', name: 'Schedule Publish', description: 'Review, approve, and publish planning scenarios to the active operating schedule. Includes change summary and approval workflow.', icon: SendHorizonal, route: '/network/control/schedule-publish' },
      { code: '1.1.6', name: 'Codeshare Manager', description: 'Manage codeshare agreements and partner flight designators. Map marketing carriers to operating flights.', icon: Link2, route: '/network/control/codeshare-manager' },
      { code: '1.1.7', name: 'Slot Manager', description: 'Track airport slot allocations, monitor utilization against IATA 80/20 rules, and manage slot requests.', icon: CalendarClock, route: '/network/control/slot-manager' },
      { code: '1.1.8', name: 'Charter Manager', description: 'Manage ad-hoc and charter flight operations separately from the mainline published schedule.', icon: PlaneTakeoff, route: '/network/control/charter-manager' },
    ],
  },
  {
    id: 'schedule-distribution',
    title: 'Schedule Distribution',
    subtitle: 'Distribute schedules to external systems and partners',
    screens: [
      { code: '1.1.9', name: 'Schedule Messaging', description: 'Generate and process ASM and SSM messages for real-time schedule change distribution to partners and GDS.', icon: MessageSquareShare, route: '/network/control/schedule-messaging' },
      { code: '1.1.10', name: 'SSIM Exchange', description: 'Import and export SSIM format files (Type 1 and Type 2) for airports, regulators, and distribution systems.', icon: FileInput, route: '/network/control/ssim-exchange' },
    ],
  },
]

export default function NetworkControlPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim().length > 0

  const filteredScreens = useMemo(() => {
    if (!isSearching) return null
    const q = searchQuery.toLowerCase().trim()
    return sections.flatMap(section =>
      section.screens.filter(screen =>
        screen.name.toLowerCase().includes(q) ||
        screen.description.toLowerCase().includes(q) ||
        screen.code.toLowerCase().includes(q) ||
        section.title.toLowerCase().includes(q)
      )
    )
  }, [searchQuery, isSearching])

  let tileIndex = 0

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      {/* Page Header */}
      <div className="animate-fade-in px-1">
        <h1 className="text-xl font-semibold tracking-tight">Network Control</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Schedule planning, administration, and distribution
        </p>
      </div>

      {/* Search Bar */}
      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules or type code (e.g. Schedule Builder or 1.1.1)..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Filtered flat grid (when searching) */}
      {isSearching ? (
        <div className="animate-fade-in">
          {filteredScreens && filteredScreens.length > 0 ? (
            <div className="grid w-full gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {filteredScreens.map((screen) => {
                const ScreenIcon = screen.icon
                return (
                  <Link
                    key={screen.code}
                    href={screen.route}
                    className="group glass rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glass-lg dark:hover:shadow-none animate-fade-up"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors duration-200">
                        <ScreenIcon className="h-[18px] w-[18px]" />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                        {screen.code}
                      </span>
                    </div>
                    <div className="text-[13px] font-medium leading-tight">{screen.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {screen.description}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No modules match &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      ) : (
        /* Section layout (default) */
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.id}>
              {/* Section Header */}
              <div className="mb-4 px-1">
                <h2 className="text-[16px] font-bold text-foreground">{section.title}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{section.subtitle}</p>
              </div>

              {/* Card Grid */}
              <div className="grid w-full gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                {section.screens.map((screen) => {
                  const ScreenIcon = screen.icon
                  const delay = tileIndex * 40
                  tileIndex++
                  return (
                    <Link
                      key={screen.code}
                      href={screen.route}
                      className="group glass rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glass-lg dark:hover:shadow-none animate-fade-up"
                      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors duration-200">
                          <ScreenIcon className="h-[18px] w-[18px]" />
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                          {screen.code}
                        </span>
                      </div>
                      <div className="text-[13px] font-medium leading-tight">{screen.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {screen.description}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
