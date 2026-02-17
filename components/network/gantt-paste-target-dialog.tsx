'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { AircraftWithRelations } from '@/app/actions/aircraft-registrations'

interface GanttPasteTargetDialogProps {
  open: boolean
  onClose: () => void
  registrations: AircraftWithRelations[]
  onSelect: (reg: string) => void
}

export function GanttPasteTargetDialog({
  open, onClose, registrations, onSelect,
}: GanttPasteTargetDialogProps) {
  const [search, setSearch] = useState('')

  // Group by aircraft type
  const grouped = useMemo(() => {
    const map = new Map<string, AircraftWithRelations[]>()
    for (const reg of registrations) {
      if (reg.status !== 'active' && reg.status !== 'operational') continue
      const icao = reg.aircraft_types?.icao_type || 'Other'

      if (search) {
        const q = search.toLowerCase()
        if (!reg.registration.toLowerCase().includes(q) && !icao.toLowerCase().includes(q)) continue
      }

      const list = map.get(icao) || []
      list.push(reg)
      map.set(icao, list)
    }
    return map
  }, [registrations, search])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[380px] p-0 gap-0 overflow-hidden" style={{
        background: 'var(--glass-bg-heavy)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--glass-border-heavy)',
      }}>
        <div className="px-4 py-3 border-b">
          <DialogTitle className="text-sm font-semibold">Paste to which aircraft?</DialogTitle>
        </div>

        <div className="px-4 py-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search registration..."
              autoFocus
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[11px] glass outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="px-4 py-2 max-h-[320px] overflow-y-auto custom-scrollbar space-y-3">
          {Array.from(grouped.entries()).map(([icao, regs]) => (
            <div key={icao}>
              <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                {icao}
              </div>
              <div className="space-y-0.5">
                {regs.map(reg => (
                  <button
                    key={reg.id}
                    onClick={() => {
                      onSelect(reg.registration)
                      setSearch('')
                      onClose()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors hover:bg-muted/30"
                  >
                    <span className="text-[12px] font-semibold">{reg.registration}</span>
                    <span className="text-[10px] text-muted-foreground">{icao}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {grouped.size === 0 && (
            <div className="text-center py-6 text-[11px] text-muted-foreground">
              No aircraft found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
