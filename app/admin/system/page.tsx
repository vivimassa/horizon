'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  UserCog,
  LayoutGrid,
  Bell,
  Plug,
  Search,
} from 'lucide-react'

interface Screen {
  code: string
  name: string
  description: string
  icon: typeof Building2
  route: string
}

const screens: Screen[] = [
  { code: '4.1.1', name: 'Operator Profile', description: 'Manage operator company profile, branding, and contact information.', icon: Building2, route: '/admin/system/operator-profile' },
  { code: '4.1.2', name: 'User Management', description: 'Manage user accounts, roles, and access permissions across operators.', icon: UserCog, route: '/admin/system/users' },
  { code: '4.1.3', name: 'Module Management', description: 'Enable, disable, and configure available system modules for your operator.', icon: LayoutGrid, route: '/admin/system/modules' },
  { code: '4.1.4', name: 'Notifications', description: 'Configure notification preferences, channels, and alert delivery rules.', icon: Bell, route: '/admin/system/notifications' },
  { code: '4.1.5', name: 'Integrations', description: 'Connect external systems, APIs, and third-party service integrations.', icon: Plug, route: '/admin/system/integrations' },
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

export default function SystemPage() {
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
        <h1 className="text-xl font-semibold tracking-tight">System</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Core system settings, users, and integrations
        </p>
      </div>

      <div className="animate-fade-in relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search system settings (e.g. Users or 4.1.2)..."
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
