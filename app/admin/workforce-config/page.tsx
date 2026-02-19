'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Award,
  MapPin,
  BadgeCheck,
  Tag,
  Scale,
  Bot,
  ListChecks,
  UsersRound,
  FileQuestion,
  Trophy,
  Search,
} from 'lucide-react'

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof Award
  route: string
}

const screens: Screen[] = [
  { code: '4.5.1', name: 'Crew Ranks', description: 'Crew rank definitions for captains, first officers, and cabin crew tiers.', icon: Award, route: '/admin/workforce-config/crew-ranks' },
  { code: '4.5.2', name: 'Crew Bases', description: 'Crew base locations defining home airports and reporting stations.', icon: MapPin, route: '/admin/workforce-config/crew-bases' },
  { code: '4.5.3', name: 'Qualification Types', description: 'Crew qualification and certification type definitions for compliance.', icon: BadgeCheck, route: '/admin/workforce-config/qualification-types' },
  { code: '4.5.4', name: 'Activity Codes', description: 'Roster activity code definitions for duty, standby, training, and leave.', icon: Tag, route: '/admin/workforce-config/activity-codes' },
  { code: '4.5.5', name: 'FDTL Rule Sets', description: 'Flight duty time limit rule sets per regulatory authority and crew type.', icon: Scale, route: '/admin/workforce-config/fdtl-rule-sets' },
  { code: '4.5.6', name: 'FDTL Rule Advisor', description: 'AI-powered FDTL compliance advisory tool for regulation interpretation.', icon: Bot, route: '/admin/workforce-config/fdtl-rule-advisor' },
  { code: '4.5.7', name: 'Roster Rules', description: 'Rostering constraint rules for duty patterns, rest periods, and limits.', icon: ListChecks, route: '/admin/workforce-config/roster-rules' },
  { code: '4.5.8', name: 'Crew Groups', description: 'Crew grouping definitions for fleet assignment and roster pooling.', icon: UsersRound, route: '/admin/workforce-config/crew-groups' },
  { code: '4.5.9', name: 'Request Types', description: 'Crew request type definitions for swaps, bids, and leave applications.', icon: FileQuestion, route: '/admin/workforce-config/request-types' },
  { code: '4.5.10', name: 'Seniority Rules', description: 'Crew seniority calculation rules for bidding priority and assignments.', icon: Trophy, route: '/admin/workforce-config/seniority-rules' },
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

export default function WorkforceConfigPage() {
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
        <h1 className="text-xl font-semibold tracking-tight">Workforce Config</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Crew ranks, bases, qualifications, FDTL rules, and rostering configuration
        </p>
      </div>

      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search workforce config (e.g. FDTL or 4.5.5)..."
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
