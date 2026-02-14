'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { SearchBox } from './search-box'
import { useUserPreferences, type DashboardShortcut } from '@/hooks/use-user-preferences'
import { type ModuleEntry } from '@/lib/modules/registry'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { preferences, updatePreferences } = useUserPreferences()

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = useCallback((mod: ModuleEntry) => {
    setOpen(false)
    router.push(mod.route)
  }, [router])

  const handlePin = useCallback((mod: ModuleEntry) => {
    const shortcuts = preferences.dashboard_layout
    const exists = shortcuts.some(s => s.code === mod.code)
    if (exists) return

    const next: DashboardShortcut[] = [
      ...shortcuts,
      { code: mod.code, order: shortcuts.length },
    ]
    updatePreferences({ dashboard_layout: next })
  }, [preferences.dashboard_layout, updatePreferences])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-heavy p-0 gap-0 max-w-lg [&>button]:hidden">
        <div className="p-4">
          <SearchBox
            onSelect={handleSelect}
            onPin={handlePin}
            showPin
            placeholder="Search modules... (name, code, or @crew)"
            autoFocus
          />
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd> Open</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd> Close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
