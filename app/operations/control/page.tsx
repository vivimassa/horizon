'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Radar,
  Search,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof Radar
  route: string
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
    id: 'operations-management',
    label: 'I',
    title: 'Operations Management',
    subtitle: 'Monitor and manage daily flight operations',
    screens: [
      {
        code: '2.1.1',
        name: 'Movement Control',
        description: 'Real-time aircraft movement tracking, flight status monitoring, and operational decision support.',
        icon: Radar,
        route: '/operations/control/movement-control',
      },
    ],
  },
]

// ─── Module card ────────────────────────────────────────────────

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

// ─── Page ──────────────────────────────────────────────────────────

export default function OperationsControlPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const isSearching = searchQuery.trim().length > 0

  const filteredScreens = useMemo(() => {
    if (!isSearching) return null
    const q = searchQuery.toLowerCase().trim()
    const results: Screen[] = []

    for (const section of sections) {
      for (const screen of section.screens) {
        if (
          screen.name.toLowerCase().includes(q) ||
          screen.description.toLowerCase().includes(q) ||
          screen.code.toLowerCase().includes(q) ||
          section.title.toLowerCase().includes(q)
        ) {
          results.push(screen)
        }
      }
    }
    return results
  }, [searchQuery, isSearching])

  let tileIndex = 0

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      {/* Page Header */}
      <div className="animate-fade-in px-1">
        <h1 className="text-xl font-semibold tracking-tight">Operations Control</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Real-time flight operations and movement management
        </p>
      </div>

      {/* Search Bar */}
      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search modules or type code (e.g. Movement Control or 2.1.1)..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm glass outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Filtered flat grid (when searching) */}
      {isSearching ? (
        <div className="animate-fade-in">
          {filteredScreens && filteredScreens.length > 0 ? (
            <div className="grid w-full gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {filteredScreens.map((screen) => (
                <ModuleCard key={screen.code} screen={screen} delay={0} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No modules match &ldquo;{searchQuery}&rdquo;
            </div>
          )}
        </div>
      ) : (
        /* ── Section columns ── */
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
                    <ModuleCard key={screen.code} screen={screen} delay={delay} />
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
