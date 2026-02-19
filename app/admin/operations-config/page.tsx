'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  GitBranch,
  MapPin,
  Timer,
  Bell,
  MessageCircle,
  Monitor,
  Wrench,
  AlertTriangle,
  Search,
} from 'lucide-react'

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof GitBranch
  route: string
}

const screens: Screen[] = [
  { code: '4.4.1', name: 'Flight Status Rules', description: 'Flight status transition rules defining valid state changes and triggers.', icon: GitBranch, route: '/admin/operations-config/flight-status-rules' },
  { code: '4.4.2', name: 'Diversion Airports', description: 'Designated diversion and alternate airport assignments for each route.', icon: MapPin, route: '/admin/operations-config/diversion-airports' },
  { code: '4.4.3', name: 'Ground Time Rules', description: 'Minimum ground time configuration by airport, aircraft type, and service.', icon: Timer, route: '/admin/operations-config/ground-time-rules' },
  { code: '4.4.4', name: 'Alert Thresholds', description: 'Operational alert thresholds for delays, fuel, and crew duty limits.', icon: Bell, route: '/admin/operations-config/alert-thresholds' },
  { code: '4.4.5', name: 'Message Configuration', description: 'Operational messaging settings for MVT, LDM, and other SITA messages.', icon: MessageCircle, route: '/admin/operations-config/message-config' },
  { code: '4.4.6', name: 'OCC Desk Configuration', description: 'Operations control centre desk layout, roles, and shift assignments.', icon: Monitor, route: '/admin/operations-config/occ-desk-config' },
  { code: '4.4.7', name: 'Maintenance Types', description: 'Maintenance event type definitions for scheduled and unscheduled checks.', icon: Wrench, route: '/admin/operations-config/maintenance-types' },
  { code: '4.4.8', name: 'Delay Codes', description: 'Operational delay code configuration and categorization mappings.', icon: AlertTriangle, route: '/admin/operations-config/delay-codes' },
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

export default function OperationsConfigPage() {
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
        <h1 className="text-xl font-semibold tracking-tight">Operations Config</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Flight rules, alerts, messaging, and OCC configuration
        </p>
      </div>

      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search operations config (e.g. Ground Time or 4.4.3)..."
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
