'use client'

import { X } from 'lucide-react'
import type { ClipboardState } from '@/lib/hooks/use-gantt-clipboard'

interface GanttClipboardPillProps {
  clipboard: ClipboardState | null
  onClear: () => void
}

export function GanttClipboardPill({ clipboard, onClear }: GanttClipboardPillProps) {
  if (!clipboard) return null

  const count = clipboard.expandedIds.size

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      <div
        className="flex items-center gap-2.5 px-4 py-2 rounded-full text-[11px] font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{
          background: 'var(--glass-bg-heavy)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid var(--glass-border-heavy)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <span>{'\u2702'}</span>
        <span>
          {count} flight{count > 1 ? 's' : ''} cut
        </span>
        {clipboard.targetReg ? (
          <span className="text-primary">
            → {clipboard.targetReg} · Ctrl+V to paste
          </span>
        ) : (
          <span className="text-muted-foreground">
            · Click a row, then Ctrl+V
          </span>
        )}
        <button
          onClick={onClear}
          className="ml-1 p-0.5 rounded-full hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}
