'use client'

import { usePathname } from 'next/navigation'

interface StatusBarProps {
  operatorName: string
  userName: string
  userRole: string
}

export function StatusBar({ operatorName, userName, userRole }: StatusBarProps) {
  const pathname = usePathname()

  if (pathname === '/login' || pathname === '/register') {
    return null
  }

  const roleLabel = userRole.replace('_', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <div className="fixed bottom-0 left-0 right-0 h-6 z-30 bg-[#E8E8E8] dark:bg-[#1A1A1F] border-t border-black/10 dark:border-white/10 flex items-center justify-between px-4">
      <span className="font-mono text-[11px] text-foreground/70 truncate">
        {operatorName}, {userName}, {roleLabel}
      </span>
      <span className="font-mono text-[11px] text-foreground/70 shrink-0">
        HORIZON v1.0.0
      </span>
    </div>
  )
}
