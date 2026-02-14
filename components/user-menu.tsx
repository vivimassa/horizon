'use client'

import { useState, useRef, useEffect } from 'react'
import { signOut } from '@/app/actions/auth'
import { useUserPreferences } from '@/hooks/use-user-preferences'
import { cn } from '@/lib/utils'
import { KeyRound, Settings, LogOut } from 'lucide-react'
import { ChangePasswordDialog } from '@/components/settings/change-password-dialog'
import { SettingsDialog } from '@/components/settings/settings-dialog'

interface UserMenuProps {
  userName: string
  userRole: string
  isAdmin: boolean
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function UserMenu({ userName, userRole, isAdmin }: UserMenuProps) {
  const { preferences } = useUserPreferences()
  const [menuOpen, setMenuOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const initials = getInitials(userName)

  return (
    <>
      <div className="relative" ref={menuRef}>
        {/* Avatar button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
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
          <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl glass-heavy p-2 animate-scale-up z-50">
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole.replace('_', ' ')}</p>
            </div>
            <div className="h-px bg-border mx-1 mb-1" />
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
