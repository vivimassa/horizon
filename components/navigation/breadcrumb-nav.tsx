'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Home, ChevronRight } from 'lucide-react'
import { getModuleByRoute } from '@/lib/modules/registry'

const labelMap: Record<string, string> = {
  home: 'Home',
  network: 'Network',
  operations: 'Operations',
  workforce: 'Workforce',
  reports: 'Reports',
  admin: 'Admin',
  control: 'Control',
  tools: 'Tools',
  system: 'System',
  'operator-profile': 'Operator Profile',
  users: 'User Management',
  modules: 'Module Management',
  notifications: 'Notification Settings',
  integrations: 'Integration Settings',
  'master-database': 'Master Database',
  airports: 'Airports',
  countries: 'Countries',
  'aircraft-types': 'Aircraft Types',
  airlines: 'Airlines',
  'city-pairs': 'City Pairs',
  'network-config': 'Network Config',
  'schedule-seasons': 'Schedule Seasons',
  'service-types': 'Service Types',
  'ssim-config': 'SSIM Configuration',
  'codeshare-config': 'Codeshare Config',
  'cabin-config': 'Cabin Configurations',
  'schedule-preferences': 'Schedule Preferences & Restrictions',
  'schedule-templates': 'Schedule Templates',
  'operations-config': 'Operations Config',
  'delay-codes': 'Delay Codes',
  'flight-status-rules': 'Flight Status Rules',
  'diversion-airports': 'Diversion Airports',
  'ground-time-rules': 'Ground Time Rules',
  'alert-thresholds': 'Alert Thresholds',
  'message-config': 'Message Configuration',
  'occ-desk-config': 'OCC Desk Config',
  'maintenance-types': 'Maintenance Types',
  'workforce-config': 'Workforce Config',
  'crew-ranks': 'Crew Ranks',
  'crew-bases': 'Crew Bases',
  'qualification-types': 'Qualification Types',
  'activity-codes': 'Activity Codes',
  'fdtl-rule-sets': 'FDTL Rule Sets',
  'fdtl-rule-advisor': 'FDTL Rule Advisor',
  'roster-rules': 'Roster Rules',
  'crew-groups': 'Crew Groups',
  'request-types': 'Request Types',
  'seniority-rules': 'Seniority Rules',
  'addon-config': 'Addon Config',
}

export function BreadcrumbNav() {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return null
  }

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Home className="h-3.5 w-3.5" />
              <span>Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          const path = '/' + segments.slice(0, index + 1).join('/')
          const baseLabel = labelMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')

          // Look up module code for this route
          const mod = getModuleByRoute(path)
          const label = mod ? `${baseLabel} (${mod.code})` : baseLabel

          return (
            <BreadcrumbItem key={path}>
              <BreadcrumbSeparator>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              </BreadcrumbSeparator>
              {isLast ? (
                <BreadcrumbPage className="text-sm">{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={path} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
