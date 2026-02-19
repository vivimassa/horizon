'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
} from 'lucide-react'

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof Globe
  route: string
}

const screens: Screen[] = [
  { code: '4.2.1', name: 'Countries', description: 'Country reference data including ISO codes, regions, and regulatory authorities.', icon: Globe, route: '/admin/master-database/countries' },
  { code: '4.2.2', name: 'Airports', description: 'Airport database with IATA/ICAO codes, coordinates, and turnaround rules.', icon: PlaneLanding, route: '/admin/master-database/airports' },
  { code: '4.2.3', name: 'Aircraft Types', description: 'Aircraft type catalogue with manufacturer, model, and seat configurations.', icon: Plane, route: '/admin/master-database/aircraft-types' },
  { code: '4.2.4', name: 'Aircraft Registrations', description: 'Individual aircraft fleet registry with registration marks and ownership.', icon: PlaneTakeoff, route: '/admin/master-database/aircraft-registrations' },
  { code: '4.2.5', name: 'Airlines', description: 'Airline reference data with IATA/ICAO designators and alliance memberships.', icon: Building, route: '/admin/master-database/airlines' },
  { code: '4.2.6', name: 'City Pairs', description: 'City pair connections defining origin-destination routes in the network.', icon: ArrowLeftRight, route: '/admin/master-database/city-pairs' },
  { code: '4.2.7', name: 'Flight Service Types', description: 'Flight service type codes for categorizing domestic, international, and charter.', icon: Tag, route: '/admin/master-database/flight-service-types' },
  { code: '4.2.8', name: 'Delay Codes', description: 'IATA standard delay code definitions for operational delay categorization.', icon: AlertTriangle, route: '/admin/master-database/delay-codes' },
  { code: '4.2.9', name: 'Cabin Classes', description: 'Cabin class definitions such as Economy, Business, and First for seat mapping.', icon: Armchair, route: '/admin/master-database/cabin-classes' },
  { code: '4.2.10', name: 'Units of Measure', description: 'System-wide unit display preferences for weight, distance, and temperature.', icon: Ruler, route: '/admin/master-database/units-of-measure' },
]

function ModuleCard({ screen, delay }: { screen: Screen; delay: number }) {
  const router = useRouter()
  const ScreenIcon = screen.icon

  return (
    <div
      onClick={() => router.push(screen.route)}
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
    </div>
  )
}

export default function MasterDatabasePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim().length > 0

  const filteredScreens = useMemo(() => {
    if (!isSearching) return screens
    const q = searchQuery.toLowerCase().trim()
    return screens.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.code.includes(q)
    )
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
            <ModuleCard key={screen.code} screen={screen} delay={i * 40} />
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
