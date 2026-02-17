import Link from 'next/link'
import {
  Calendar,
  PenLine,
  LayoutGrid,
  CalendarRange,
  Send,
  Mail,
  FileCheck,
  Network,
  Link as LinkIcon,
  Globe,
  ArrowUpDown,
  Download,
  Upload,
  GitCompareArrows,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const sections = [
  {
    id: 'schedule-management',
    title: 'Schedule Management',
    subtitle: 'Build, visualize, and plan flight schedules',
    icon: Calendar,
    screens: [
      { code: '1.1.1', name: 'Schedule Builder', description: 'Create and edit seasonal flight schedules', icon: PenLine, route: '/network/control/schedule-builder' },
      { code: '1.1.2', name: 'Schedule Grid', description: 'Visual grid view of flight schedules by route and day', icon: LayoutGrid, route: '/network/control/schedule-grid' },
      { code: '1.1.6', name: 'Seasonal Planner', description: 'Plan and compare seasonal schedule strategies', icon: CalendarRange, route: '/network/control/seasonal-planner' },
    ],
  },
  {
    id: 'flight-publishing',
    title: 'Flight Publishing & Messaging',
    subtitle: 'Publish schedules and manage schedule messages',
    icon: Send,
    screens: [
      { code: '1.1.3', name: 'Schedule Messages', description: 'SSIM and ASM/SSM schedule messaging', icon: Mail, route: '/network/control/schedule-messages' },
      { code: '1.1.4', name: 'Flight Publish', description: 'Publish schedule templates into operational flights', icon: FileCheck, route: '/network/control/flight-publish' },
    ],
  },
  {
    id: 'network-planning',
    title: 'Network Planning',
    subtitle: 'Manage codeshares and network capacity',
    icon: Network,
    screens: [
      { code: '1.1.5', name: 'Codeshare Manager', description: 'Manage codeshare agreements and mappings', icon: LinkIcon, route: '/network/control/codeshare-manager' },
      { code: '1.1.7', name: 'Network Map', description: 'Interactive route network visualization', icon: Globe, route: '/network/control/network-map' },
    ],
  },
  {
    id: 'ssim-exchange',
    title: 'SSIM Data Exchange',
    subtitle: 'Import, export, and compare IATA standard schedules',
    icon: ArrowUpDown,
    screens: [
      { code: '1.1.8.1', name: 'SSIM Import', description: 'Parse and import SSIM Chapter 7 schedule files', icon: Download, route: '/network/control/ssim/import' },
      { code: '1.1.8.2', name: 'SSIM Export', description: 'Generate SSIM files for distribution to partners', icon: Upload, route: '/network/control/ssim/export' },
      { code: '1.1.8.3', name: 'Schedule Comparison', description: 'Diff and compare schedule versions side by side', icon: GitCompareArrows, route: '/network/control/ssim/comparison' },
    ],
  },
]

export default function NetworkControlPage() {
  let tileIndex = 0

  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      {/* Page Header */}
      <div className="animate-fade-in">
        <Card>
          <CardHeader>
            <CardTitle>Network Control</CardTitle>
            <CardDescription>
              Monitor and control network infrastructure
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Sections with Tile Grids */}
      <div className="space-y-5">
        {sections.map((section) => {
          const SectionIcon = section.icon
          return (
            <div key={section.id}>
              {/* Section Label — lightweight, no card wrapper */}
              <div className="flex items-center gap-2.5 mb-2 px-1">
                <div className="p-1.5 rounded-lg bg-primary/[0.12] text-primary">
                  <SectionIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">{section.title}</div>
                  <div className="text-[11px] text-muted-foreground">{section.subtitle}</div>
                </div>
              </div>

              {/* Tile Grid — responsive auto-fill */}
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
          )
        })}
      </div>
    </div>
  )
}
