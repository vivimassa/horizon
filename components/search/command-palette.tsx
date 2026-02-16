'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { SearchBox } from './search-box'
import { type ModuleEntry, isLeafModule } from '@/lib/modules/registry'
import { addShortcut } from '@/app/actions/shortcuts'
import { toast } from 'sonner'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

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

  const handlePin = useCallback(async (mod: ModuleEntry) => {
    if (!isLeafModule(mod.code)) {
      toast('Only leaf pages can be pinned')
      return
    }
    const result = await addShortcut({
      pageCode: mod.code,
      pageName: mod.name,
      pagePath: mod.route,
      pageIcon: mod.icon,
    })
    if (result.success) {
      toast(`Added ${mod.name} to your dashboard`)
    } else if (result.error?.includes('duplicate')) {
      toast(`${mod.name} is already on your dashboard`)
    }
  }, [])

  const handleDragAdd = useCallback(async (mod: ModuleEntry) => {
    if (!isLeafModule(mod.code)) return
    const result = await addShortcut({
      pageCode: mod.code,
      pageName: mod.name,
      pagePath: mod.route,
      pageIcon: mod.icon,
    })
    if (result.success) {
      toast(`Added ${mod.name} to your dashboard`)
    } else if (result.error?.includes('duplicate')) {
      toast(`${mod.name} is already on your dashboard`)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="glass-heavy p-0 gap-0 max-w-lg [&>button]:hidden">
        <div className="p-4">
          <SearchBox
            onSelect={handleSelect}
            onPin={handlePin}
            onDragAdd={handleDragAdd}
            showPin
            showDrag
            placeholder="Search modules... (name, code, or @crew)"
            autoFocus
          />
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd> Open</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Esc</kbd> Close</span>
            <span className="ml-auto"><kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">Drag</kbd> Add to dashboard</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
