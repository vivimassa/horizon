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

const moduleLabels: Record<string, string> = {
  home: 'Home',
  network: 'Network',
  operations: 'Operations',
  workforce: 'Workforce',
  reports: 'Reports',
  admin: 'Admin',
  control: 'Control',
  tools: 'Tools',
}

export function BreadcrumbNav() {
  const pathname = usePathname()

  // Skip breadcrumbs on auth pages
  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  const segments = pathname.split('/').filter(Boolean)

  // If on home page, show minimal breadcrumb
  if (segments.length === 0) {
    return (
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span>Home</span>
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        {/* Home link */}
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link href="/" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span>Home</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>

        {/* Segments */}
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1
          const path = '/' + segments.slice(0, index + 1).join('/')
          const label = moduleLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)

          return (
            <BreadcrumbItem key={path}>
              <BreadcrumbSeparator>
                <ChevronRight className="h-4 w-4" />
              </BreadcrumbSeparator>
              {isLast ? (
                <BreadcrumbPage>{label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={path}>{label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
