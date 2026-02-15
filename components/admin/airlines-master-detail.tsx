'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Airline } from '@/types/database'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import {
  updateAirlineField,
  createAirline,
  deleteAirline,
} from '@/app/actions/airlines'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  Search,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ──────────────────────────────────────────────────────────

const ALLIANCE_COLORS: Record<string, string> = {
  'Star Alliance': 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  'oneworld': 'bg-red-500/15 text-red-700 dark:text-red-400',
  'SkyTeam': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
}

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  airlines: Airline[]
}

// ─── Main Component ─────────────────────────────────────────────────────

export function AirlinesMasterDetail({ airlines: initial }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Airline | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)

  const airlines = initial

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    if (selected) {
      const updated = airlines.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [airlines, selected])

  const filtered = useMemo(() => {
    if (!search) return airlines
    const q = search.toLowerCase()
    return airlines.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.icao_code.toLowerCase().includes(q) ||
      (a.iata_code || '').toLowerCase().includes(q) ||
      (a.callsign || '').toLowerCase().includes(q) ||
      (a.country || '').toLowerCase().includes(q)
    )
  }, [airlines, search])

  // Group by country
  const grouped = useMemo(() => {
    const groups: Record<string, Airline[]> = {}
    for (const a of filtered) {
      const country = a.country || 'Unknown'
      if (!groups[country]) groups[country] = []
      groups[country].push(a)
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  // ─── List Header ────────────────────────────────────────────────────

  const renderListHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Airlines</h2>
          <Badge variant="secondary" className="text-[10px]">{airlines.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search airlines..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs pl-9"
        />
      </div>
    </div>
  )

  // ─── List Body (grouped by country) ─────────────────────────────────

  const renderListBody = (renderItem: (item: Airline) => React.ReactNode) => (
    <>
      {grouped.map(([country, items]) => {
        const isCollapsed = collapsed[country]
        return (
          <div key={country}>
            <button
              onClick={() => toggleGroup(country)}
              className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-200', !isCollapsed && 'rotate-90')} />
              <span>{country}</span>
              <span className="text-muted-foreground/40">({items.length})</span>
              <div className="flex-1 h-px bg-border/50 ml-1" />
            </button>
            <div className={cn('region-collapse', !isCollapsed && 'expanded')}>
              <div className="space-y-0.5">
                {items.map(item => renderItem(item))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )

  // ─── List Item ──────────────────────────────────────────────────────

  const renderListItem = (airline: Airline, isSelected: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <div className={cn('h-2 w-2 rounded-full shrink-0', airline.is_active ? 'bg-emerald-500' : 'bg-gray-400')} />
      <span className={cn('font-mono text-sm font-bold shrink-0', isSelected ? 'text-primary' : 'text-foreground')}>
        {airline.iata_code || airline.icao_code}
      </span>
      <span className="text-sm truncate text-muted-foreground">{airline.name}</span>
      {airline.is_own_airline && (
        <Badge variant="secondary" className="text-[9px] shrink-0 px-1 py-0">Own</Badge>
      )}
    </div>
  )

  const renderCompactListItem = (airline: Airline) => (
    <div className="text-center">
      <div className="font-mono text-[10px] font-bold">{airline.iata_code || airline.icao_code}</div>
    </div>
  )

  // ─── Detail ─────────────────────────────────────────────────────────

  const renderDetail = (airline: Airline) => (
    <DetailPanel airline={airline} onFieldUpdated={refresh} onDeleted={() => { setSelected(null); refresh() }} />
  )

  return (
    <>
      <MasterDetailLayout<Airline>
        items={filtered}
        selectedItem={selected}
        onSelectItem={setSelected}
        keyExtractor={a => a.id}
        renderListItem={renderListItem}
        renderCompactListItem={renderCompactListItem}
        renderDetail={renderDetail}
        renderListHeader={renderListHeader}
        renderListBody={renderListBody}
        className="h-full"
      />
      {showAddDialog && (
        <AddAirlineDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onCreated={refresh} />
      )}
    </>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────

function DetailPanel({
  airline, onFieldUpdated, onDeleted,
}: {
  airline: Airline
  onFieldUpdated: () => void
  onDeleted: () => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteAirline(airline.id)
    setDeleting(false)
    if (result?.error) {
      alert(result.error)
      setShowDeleteConfirm(false)
    } else {
      setShowDeleteConfirm(false)
      onDeleted()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="shrink-0 mb-4 glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold text-primary">{airline.iata_code || '—'}</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono text-2xl font-bold">{airline.icao_code}</span>
            </div>
            <div className="text-lg font-semibold mt-1">{airline.name}</div>
            {airline.callsign && (
              <div className="text-sm text-muted-foreground font-mono mt-0.5">Callsign: {airline.callsign}</div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {airline.alliance && (
              <Badge className={cn('text-xs', ALLIANCE_COLORS[airline.alliance] || 'bg-muted')}>
                {airline.alliance}
              </Badge>
            )}
            {airline.is_own_airline && (
              <Badge variant="secondary" className="text-xs">Own Airline</Badge>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all duration-200"
              title="Delete airline"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="glass rounded-2xl p-4 space-y-0">
        <InlineField label="IATA Code" field="iata_code" value={airline.iata_code || ''} id={airline.id} onSaved={onFieldUpdated} mono />
        <InlineField label="ICAO Code" field="icao_code" value={airline.icao_code} id={airline.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Name" field="name" value={airline.name} id={airline.id} onSaved={onFieldUpdated} />
        <InlineField label="Callsign" field="callsign" value={airline.callsign || ''} id={airline.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Country" field="country" value={airline.country || ''} id={airline.id} onSaved={onFieldUpdated} />
        <InlineField label="Alliance" field="alliance" value={airline.alliance || ''} id={airline.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Active" field="is_active" value={airline.is_active} id={airline.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Own Airline" field="is_own_airline" value={airline.is_own_airline} id={airline.id} onSaved={onFieldUpdated} />
        <InlineField label="Notes" field="notes" value={airline.notes || ''} id={airline.id} onSaved={onFieldUpdated} />
      </div>

      {/* Delete confirm */}
      <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete {airline.iata_code || airline.icao_code} — {airline.name}?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Inline Edit Helpers ────────────────────────────────────────────────

function InlineField({
  label, field, value, id, onSaved, mono,
}: {
  label: string; field: string; value: string; id: string; onSaved: () => void; mono?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const [flashClass, setFlashClass] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = useCallback(async () => {
    if (editValue === value) { setEditing(false); return }
    setSaving(true)
    const result = await updateAirlineField(id, field, editValue || null)
    setSaving(false)
    if (result?.error) {
      alert(result.error)
      setEditValue(value)
    } else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
    setEditing(false)
  }, [id, field, editValue, value, onSaved])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditValue(value); setEditing(false) }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5', flashClass)}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          disabled={saving}
          className={cn('h-8 text-sm', mono && 'font-mono')}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px]',
            mono && 'font-mono',
            !value && 'text-muted-foreground italic'
          )}
        >
          {value || '—'}
        </button>
      )}
    </div>
  )
}

function InlineToggle({
  label, field, value, id, onSaved,
}: {
  label: string; field: string; value: boolean; id: string; onSaved: () => void
}) {
  const [flashClass, setFlashClass] = useState('')

  const handleChange = async (checked: boolean) => {
    const result = await updateAirlineField(id, field, checked)
    if (result?.error) {
      alert(result.error)
    } else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5 flex items-center justify-between', flashClass)}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <Switch checked={value} onCheckedChange={handleChange} />
    </div>
  )
}

// ─── Add Airline Dialog ─────────────────────────────────────────────────

function AddAirlineDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await createAirline(formData)
    setSaving(false)
    if (result?.error) alert(result.error)
    else {
      onCreated()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-heavy max-w-md">
        <DialogHeader>
          <DialogTitle>Add Airline</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">IATA Code</label>
              <Input name="iata_code" className="h-8 text-sm mt-1 font-mono" placeholder="VJ" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">ICAO Code *</label>
              <Input name="icao_code" required className="h-8 text-sm mt-1 font-mono" placeholder="VJC" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Name *</label>
            <Input name="name" required className="h-8 text-sm mt-1" placeholder="VietJet Air" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Callsign</label>
              <Input name="callsign" className="h-8 text-sm mt-1 font-mono" placeholder="VIETJET" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Country</label>
              <Input name="country" className="h-8 text-sm mt-1" placeholder="Vietnam" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Alliance</label>
            <Input name="alliance" className="h-8 text-sm mt-1" placeholder="Star Alliance, oneworld, SkyTeam..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
