'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Upload, Download, GitCompareArrows } from 'lucide-react'

const ssimTabs = [
  { id: 'import', label: 'Import', icon: Upload, href: '/network/control/ssim/import' },
  { id: 'export', label: 'Export', icon: Download, href: '/network/control/ssim/export' },
  { id: 'comparison', label: 'Comparison', icon: GitCompareArrows, href: '/network/control/ssim/comparison' },
]

export function SsimSubNav() {
  const pathname = usePathname()

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl glass w-fit mb-6">
      {ssimTabs.map((tab) => {
        const Icon = tab.icon
        const active = pathname === tab.href || pathname.startsWith(tab.href + '/')

        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              active
                ? 'bg-primary/15 text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10'
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
