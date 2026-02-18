'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
  ChevronDown,
  ArrowRight,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────

interface SubModule {
  number: string
  name: string
  route: string
}

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof PenLine
  route?: string
  subModules?: SubModule[]
}

interface Section {
  id: string
  label: string
  title: string
  subtitle: string
  screens: Screen[]
}

// ─── Data ──────────────────────────────────────────────────────────

const sections: Section[] = [
  {
    id: 'schedule-planning',
    label: 'I',
    title: 'Schedule Planning',
    subtitle: 'Build, review, and optimise flight schedules',
    screens: [
      { code: '1.1.1', name: 'Schedule Builder', description: 'Create and manage aircraft routes with flight legs, frequencies, and seasonal periods.', icon: PenLine, route: '/network/control/schedule-builder' },
      { code: '1.1.2', name: 'Schedule Grid', description: 'Tabular view of scheduled flights with inline editing, filtering, and bulk operations.', icon: LayoutGrid, route: '/network/control/schedule-grid' },
      { code: '1.1.3', name: 'Gantt Chart', description: 'Aircraft rotation timeline showing fleet utilization, tail assignment, and conflicts.', icon: GanttChartIcon, route: '/network/control/schedule-gantt' },
      { code: '1.1.4', name: 'Schedule Comparison', description: 'Compare planning scenarios side by side to analyse utilization, block hours, and coverage.', icon: GitCompareArrows, route: '/network/control/schedule-comparison' },
    ],
  },
  {
    id: 'schedule-administration',
    label: 'II',
    title: 'Schedule Administration',
    subtitle: 'Publish schedules and manage compliance',
    screens: [
      { code: '1.1.5', name: 'Schedule Publish', description: 'Review, approve, and publish planning scenarios to the active schedule with change summaries.', icon: SendHorizonal, route: '/network/control/schedule-publish' },
      { code: '1.1.6', name: 'Codeshare Manager', description: 'Manage codeshare agreements and partner designators. Map marketing carriers to operating flights.', icon: Link2, route: '/network/control/codeshare-manager' },
      { code: '1.1.7', name: 'Slot Manager', description: 'Track airport slot allocations, monitor utilization against IATA 80/20 rules, and manage requests.', icon: CalendarClock, route: '/network/control/slot-manager' },
      { code: '1.1.8', name: 'Charter Manager', description: 'Manage ad-hoc and charter flight operations separately from the mainline published schedule.', icon: PlaneTakeoff, route: '/network/control/charter-manager' },
    ],
  },
  {
    id: 'schedule-distribution',
    label: 'III',
    title: 'Schedule Distribution',
    subtitle: 'Distribute schedules to external systems and partners',
    screens: [
      { code: '1.1.9', name: 'Schedule Messaging', description: 'Generate and process ASM/SSM messages for real-time schedule distribution to partners and GDS.', icon: MessageSquareShare, route: '/network/control/schedule-messaging' },
      {
        code: '1.1.10',
        name: 'SSIM Exchange',
        description: 'Import and export SSIM files (Type 1 and Type 2) for airports, regulators, and distribution systems.',
        icon: FileInput,
        subModules: [
          { number: '1.1.10.1', name: 'SSIM Import', route: '/network/control/ssim/import' },
          { number: '1.1.10.2', name: 'SSIM Export', route: '/network/control/ssim/export' },
          { number: '1.1.10.3', name: 'SSIM Comparison', route: '/network/control/ssim/comparison' },
        ],
      },
    ],
  },
]

// ─── Sub-module row ────────────────────────────────────────────────

function SubModuleRow({ sub }: { sub: SubModule }) {
  return (
    <Link
      href={sub.route}
      onClick={(e) => e.stopPropagation()}
      className="group/sub flex items-center justify-between py-1.5 px-1 cursor-pointer transition-colors duration-150 rounded
        hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums shrink-0">
          {sub.number}
        </span>
        <span className="text-[12px] text-muted-foreground group-hover/sub:text-foreground truncate transition-colors duration-150">
          {sub.name}
        </span>
      </div>
      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0 transition-all duration-150 group-hover/sub:text-muted-foreground group-hover/sub:translate-x-0.5" />
    </Link>
  )
}

// ─── Expandable content (animated) ─────────────────────────────────

function ExpandableContent({ subModules, expanded }: { subModules: SubModule[]; expanded: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [subModules])

  return (
    <div
      className="overflow-hidden transition-all duration-200 ease-out"
      style={{ maxHeight: expanded ? height : 0, opacity: expanded ? 1 : 0 }}
    >
      <div ref={contentRef} className="pt-2 space-y-0.5">
        {subModules.map((sub) => (
          <SubModuleRow key={sub.number} sub={sub} />
        ))}
      </div>
    </div>
  )
}

// ─── Module card (Type A or Type B) ────────────────────────────────

function ModuleCard({
  screen,
  delay,
  expanded,
  onToggle,
}: {
  screen: Screen
  delay: number
  expanded: boolean
  onToggle: () => void
}) {
  const router = useRouter()
  const hasSubModules = screen.subModules && screen.subModules.length > 0
  const ScreenIcon = screen.icon

  const handleClick = () => {
    if (hasSubModules) {
      onToggle()
    } else if (screen.route) {
      router.push(screen.route)
    }
  }

  return (
    <div
      onClick={handleClick}
      className="group glass rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-glass-lg dark:hover:shadow-none animate-fade-up cursor-pointer relative flex flex-col"
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
      <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed flex-1">
        {screen.description}
      </div>

      {hasSubModules && (
        <>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground/60">
              {screen.subModules!.length} sub-module{screen.subModules!.length !== 1 ? 's' : ''}
            </span>
            <ChevronDown
              className="h-3 w-3 text-muted-foreground/50 transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </div>
          <ExpandableContent subModules={screen.subModules!} expanded={expanded} />
        </>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────

export default function NetworkControlPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const isSearching = searchQuery.trim().length > 0

  const toggleCard = (moduleCode: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(moduleCode)) {
        next.delete(moduleCode)
      } else {
        next.add(moduleCode)
      }
      return next
    })
  }

  // Search: match screens + sub-modules (surface parent card)
  const filteredScreens = useMemo(() => {
    if (!isSearching) return null
    const q = searchQuery.toLowerCase().trim()
    const results: Screen[] = []

    for (const section of sections) {
      for (const screen of section.screens) {
        const screenMatches =
          screen.name.toLowerCase().includes(q) ||
          screen.description.toLowerCase().includes(q) ||
          screen.code.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q)

        if (screenMatches) {
          results.push(screen)
          continue
        }

        if (screen.subModules) {
          const subMatch = screen.subModules.some(
            (sub) =>
              sub.name.toLowerCase().includes(q) ||
              sub.number.toLowerCase().includes(q)
          )
          if (subMatch) results.push(screen)
        }
      }
    }
    return results
  }, [searchQuery, isSearching])

  // Auto-expand cards whose sub-modules match search
  const searchExpandedCodes = useMemo(() => {
    if (!isSearching) return new Set<string>()
    const q = searchQuery.toLowerCase().trim()
    const codes = new Set<string>()
    for (const section of sections) {
      for (const screen of section.screens) {
        if (screen.subModules) {
          const subMatch = screen.subModules.some(
            (sub) =>
              sub.name.toLowerCase().includes(q) ||
              sub.number.toLowerCase().includes(q)
          )
          if (subMatch) codes.add(screen.code)
        }
      }
    }
    return codes
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
              {filteredScreens.map((screen) => (
                <ModuleCard
                  key={screen.code}
                  screen={screen}
                  delay={0}
                  expanded={expandedCards.has(screen.code) || searchExpandedCodes.has(screen.code)}
                  onToggle={() => toggleCard(screen.code)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No modules match &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      ) : (
        /* ── Section columns: side-by-side on desktop, stacked on mobile ── */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 items-start">
          {sections.map((section) => (
            <div key={section.id} className="min-w-0">
              {/* Section Header */}
              <div className="mb-3 px-1">
                <h2 className="text-[15px] font-bold text-foreground tracking-tight">
                  {section.label}. {section.title}
                </h2>
                <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
                  {section.subtitle}
                </p>
              </div>

              {/* Cards stack vertically within each column */}
              <div className="grid grid-cols-1 gap-2">
                {section.screens.map((screen) => {
                  const delay = tileIndex * 40
                  tileIndex++
                  return (
                    <ModuleCard
                      key={screen.code}
                      screen={screen}
                      delay={delay}
                      expanded={expandedCards.has(screen.code)}
                      onToggle={() => toggleCard(screen.code)}
                    />
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
