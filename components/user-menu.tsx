'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { signOut } from '@/app/actions/auth'
import { getUserOperators, switchOperator, type UserOperator } from '@/app/actions/operator'
import { useRouter } from 'next/navigation'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { cn } from '@/lib/utils'
import { KeyRound, Settings, LogOut, Building2, ArrowLeft, Check } from 'lucide-react'
import { ChangePasswordDialog } from '@/components/settings/change-password-dialog'
import { SettingsDialog } from '@/components/settings/settings-dialog'

interface UserMenuProps {
  userName: string
  userRole: string
  isAdmin: boolean
  currentOperatorId?: string
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function UserMenu({ userName, userRole, isAdmin, currentOperatorId }: UserMenuProps) {
  const { preferences } = useUserPreferences()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showOperators, setShowOperators] = useState(false)
  const [operators, setOperators] = useState<UserOperator[]>([])
  const [isPending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
        setShowOperators(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  async function handleShowOperators() {
    const ops = await getUserOperators()
    setOperators(ops)
    setShowOperators(true)
  }

  function handleSwitchOperator(operatorId: string) {
    startTransition(async () => {
      const result = await switchOperator(operatorId)
      if (result.success) {
        setMenuOpen(false)
        setShowOperators(false)
        router.refresh()
      }
    })
  }

  const initials = getInitials(userName)

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* Avatar button */}
        <button
          onClick={() => { setMenuOpen(!menuOpen); setShowOperators(false) }}
          className={cn(
            'w-10 h-10 rounded-full overflow-hidden flex items-center justify-center',
            'bg-primary/15 text-primary font-semibold text-sm',
            'border-2 border-border hover:border-primary/40 transition-all duration-200',
            'hover:scale-105',
            menuOpen && 'border-primary/40'
          )}
        >
          {preferences.avatar_url ? (
            <img src={preferences.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl glass-heavy p-2 animate-scale-up z-50">
            {showOperators ? (
              /* ── Operator List View ── */
              <>
                <button
                  onClick={() => setShowOperators(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-xl hover:bg-white/40 dark:hover:bg-white/10 transition-colors text-muted-foreground mb-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </button>
                <div className="h-px bg-border mx-1 mb-1" />
                {operators.map(op => (
                  <button
                    key={op.id}
                    onClick={() => handleSwitchOperator(op.id)}
                    disabled={isPending}
                    className={cn(
                      'flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-xl transition-colors',
                      op.id === currentOperatorId
                        ? 'bg-primary/10 text-primary'
                        : 'hover:bg-white/40 dark:hover:bg-white/10'
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left truncate">{op.name}</span>
                    {op.id === currentOperatorId && (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                ))}
              </>
            ) : (
              /* ── Main Menu View ── */
              <>
                <div className="px-3 py-2 mb-1">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userRole.replace('_', ' ')}</p>
                </div>
                <div className="h-px bg-border mx-1 mb-1" />
                <button
                  onClick={handleShowOperators}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-xl hover:bg-white/40 dark:hover:bg-white/10 transition-colors"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Switch Operator
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setPasswordOpen(true) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-xl hover:bg-white/40 dark:hover:bg-white/10 transition-colors"
                >
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  Change Password
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setSettingsOpen(true) }}
                  className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-xl hover:bg-white/40 dark:hover:bg-white/10 transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  mySettings
                </button>
                <div className="h-px bg-border mx-1 my-1" />
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm rounded-xl hover:bg-white/40 dark:hover:bg-white/10 transition-colors text-destructive"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        userName={userName}
        isAdmin={isAdmin}
      />
    </>
  )
}
