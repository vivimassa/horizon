'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Globe,
  PlaneLanding,
  Plane,
  PlaneTakeoff,
  Building,
  ArrowLeftRight,
  Tag,
  AlertTriangle,
  Armchair,
  Ruler,
  Search,
  ChevronDown,
  ArrowRight,
} from 'lucide-react'

interface SubModule {
  number: string
  name: string
  route: string
}

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof Globe
  route: string
  subModules?: SubModule[]
}

const screens: Screen[] = [
  { code: '4.2.1', name: 'Countries', description: 'Country reference data including ISO codes, regions, and regulatory authorities.', icon: Globe, route: '/admin/master-database/countries' },
  { code: '4.2.2', name: 'Airports', description: 'Airport database with IATA/ICAO codes, coordinates, and turnaround rules.', icon: PlaneLanding, route: '/admin/master-database/airports' },
  { code: '4.2.3', name: 'Aircraft Types', description: 'Aircraft type catalogue with manufacturer, model, and seat configurations.', icon: Plane, route: '/admin/master-database/aircraft-types' },
  { code: '4.2.4', name: 'Aircraft Registrations', description: 'Individual aircraft fleet registry with registration marks and ownership.', icon: PlaneTakeoff, route: '/admin/master-database/aircraft-registrations', subModules: [{ number: '4.2.4.1', name: 'Performance Factor', route: '/admin/master-database/aircraft-registrations/performance-factor' }] },
  { code: '4.2.5', name: 'Airlines', description: 'Airline reference data with IATA/ICAO designators and alliance memberships.', icon: Building, route: '/admin/master-database/airlines' },
  { code: '4.2.6', name: 'City Pairs', description: 'City pair connections defining origin-destination routes in the network.', icon: ArrowLeftRight, route: '/admin/master-database/city-pairs' },
  { code: '4.2.7', name: 'Flight Service Types', description: 'Flight service type codes for categorizing domestic, international, and charter.', icon: Tag, route: '/admin/master-database/flight-service-types' },
  { code: '4.2.8', name: 'Delay Codes', description: 'IATA standard delay code definitions for operational delay categorization.', icon: AlertTriangle, route: '/admin/master-database/delay-codes' },
  { code: '4.2.9', name: 'Cabin Classes', description: 'Cabin class definitions such as Economy, Business, and First for seat mapping.', icon: Armchair, route: '/admin/master-database/cabin-classes' },
  { code: '4.2.10', name: 'Units of Measure', description: 'System-wide unit display preferences for weight, distance, and temperature.', icon: Ruler, route: '/admin/master-database/units-of-measure' },
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

// ─── Module card ───────────────────────────────────────────────────

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
    } else {
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

export default function MasterDatabasePage() {
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

  const filteredScreens = useMemo(() => {
    if (!isSearching) return screens
    const q = searchQuery.toLowerCase().trim()
    return screens.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.code.includes(q) ||
        (s.subModules?.some(
          (sub) =>
            sub.name.toLowerCase().includes(q) ||
            sub.number.toLowerCase().includes(q)
        ))
    )
  }, [searchQuery, isSearching])

  // Auto-expand cards whose sub-modules match search
  const searchExpandedCodes = useMemo(() => {
    if (!isSearching) return new Set<string>()
    const q = searchQuery.toLowerCase().trim()
    const codes = new Set<string>()
    for (const screen of screens) {
      if (screen.subModules) {
        const subMatch = screen.subModules.some(
          (sub) =>
            sub.name.toLowerCase().includes(q) ||
            sub.number.toLowerCase().includes(q)
        )
        if (subMatch) codes.add(screen.code)
      }
    }
    return codes
  }, [searchQuery, isSearching])

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      <div className="animate-fade-in px-1">
        <h1 className="text-xl font-semibold tracking-tight">Master Database</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Core reference data for airports, aircraft, airlines, and routes
        </p>
      </div>

      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search master data (e.g. Airports or 4.2.2)..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
        />
      </div>

      {filteredScreens.length > 0 ? (
        <div className="grid w-full gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
          {filteredScreens.map((screen, i) => (
            <ModuleCard
              key={screen.code}
              screen={screen}
              delay={i * 40}
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
  )
}
