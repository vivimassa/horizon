'use client'

import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/user-menu'

interface GlobalHeaderProps {
  userName: string
  userRole: string
  isAdmin: boolean
  currentOperatorId?: string
  operatorLogoUrl?: string | null
}

export function GlobalHeader({ userName, userRole, isAdmin, currentOperatorId, operatorLogoUrl }: GlobalHeaderProps) {
  const pathname = usePathname()

  // Hide on auth pages
  if (pathname === '/login' || pathname === '/register') return null

  return (
    <div className="fixed top-2 right-3 z-40 flex items-center gap-3">
      {operatorLogoUrl && (
        <img
          src={operatorLogoUrl}
          alt="Operator logo"
          className="h-8 w-auto object-contain"
        />
      )}
      <UserMenu
        userName={userName}
        userRole={userRole}
        isAdmin={isAdmin}
        currentOperatorId={currentOperatorId}
      />
    </div>
  )
}
