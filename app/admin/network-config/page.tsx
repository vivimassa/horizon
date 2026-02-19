'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  Link as LinkIcon,
  SlidersHorizontal,
  Armchair,
  FileSpreadsheet,
  Tag,
  Search,
} from 'lucide-react'

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof Calendar
  route: string
}

const screens: Screen[] = [
  { code: '4.3.1', name: 'Schedule Seasons', description: 'Define IATA schedule seasons with start and end dates for planning periods.', icon: Calendar, route: '/admin/network-config/schedule-seasons' },
  { code: '4.3.2', name: 'Codeshare Config', description: 'Codeshare agreement settings and partner airline designator mappings.', icon: LinkIcon, route: '/admin/network-config/codeshare-config' },
  { code: '4.3.3', name: 'Schedule Preferences', description: 'Rules and constraints for tail assignment optimization and scheduling.', icon: SlidersHorizontal, route: '/admin/network-config/schedule-preferences' },
  { code: '4.3.4', name: 'Cabin Config', description: 'Cabin configuration settings for seat maps and class of service layouts.', icon: Armchair, route: '/admin/network-config/cabin-config' },
  { code: '4.3.5', name: 'Schedule Templates', description: 'Schedule template definitions for recurring seasonal flight patterns.', icon: FileSpreadsheet, route: '/admin/network-config/schedule-templates' },
  { code: '4.3.6', name: 'Service Types', description: 'Flight service type configuration for operational categorization rules.', icon: Tag, route: '/admin/network-config/service-types' },
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

export default function NetworkConfigPage() {
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
        <h1 className="text-xl font-semibold tracking-tight">Network Config</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Schedule seasons, codeshare settings, and network module configuration
        </p>
      </div>

      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search network config (e.g. Seasons or 4.3.1)..."
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
