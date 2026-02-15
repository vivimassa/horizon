'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { FlightServiceType } from '@/types/database'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import {
  updateFlightServiceTypeField,
  createFlightServiceType,
  deleteFlightServiceType,
} from '@/app/actions/flight-service-types'
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
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  flightServiceTypes: FlightServiceType[]
}

// ─── Main Component ─────────────────────────────────────────────────────

export function FlightServiceTypesMasterDetail({ flightServiceTypes: initial }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<FlightServiceType | null>(null)
  const [search, setSearch] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  const types = initial

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    if (selected) {
      const updated = types.find(t => t.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [types, selected])

  const filtered = useMemo(() => {
    if (!search) return types
    const q = search.toLowerCase()
    return types.filter(t =>
      t.code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.description || '').toLowerCase().includes(q)
    )
  }, [types, search])

  const renderListHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Service Types</h2>
          <Badge variant="secondary" className="text-[10px]">{types.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search service types..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs pl-9"
        />
      </div>
    </div>
  )

  const renderListItem = (type: FlightServiceType, isSelected: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="h-3 w-3 rounded-full shrink-0 border border-white/20"
        style={{ backgroundColor: type.color || '#6b7280' }}
      />
      <span className={cn('font-mono text-sm font-bold shrink-0', isSelected ? 'text-primary' : 'text-foreground')}>
        {type.code}
      </span>
      <span className="text-sm truncate text-muted-foreground">{type.name}</span>
    </div>
  )

  const renderCompactListItem = (type: FlightServiceType) => (
    <div className="text-center">
      <div
        className="h-2.5 w-2.5 rounded-full mx-auto mb-0.5 border border-white/20"
        style={{ backgroundColor: type.color || '#6b7280' }}
      />
      <div className="font-mono text-[10px] font-bold">{type.code}</div>
    </div>
  )

  const renderDetail = (type: FlightServiceType) => (
    <DetailPanel type={type} onFieldUpdated={refresh} onDeleted={() => { setSelected(null); refresh() }} />
  )

  return (
    <>
      <MasterDetailLayout<FlightServiceType>
        items={filtered}
        selectedItem={selected}
        onSelectItem={setSelected}
        keyExtractor={t => t.id}
        renderListItem={renderListItem}
        renderCompactListItem={renderCompactListItem}
        renderDetail={renderDetail}
        renderListHeader={renderListHeader}
        className="h-full"
      />
      {showAddDialog && (
        <AddServiceTypeDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onCreated={refresh} />
      )}
    </>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────

function DetailPanel({
  type, onFieldUpdated, onDeleted,
}: {
  type: FlightServiceType
  onFieldUpdated: () => void
  onDeleted: () => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteFlightServiceType(type.id)
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
          <div className="flex items-center gap-3">
            <div
              className="h-5 w-5 rounded-full border border-white/20"
              style={{ backgroundColor: type.color || '#6b7280' }}
            />
            <span className="font-mono text-2xl font-bold">{type.code}</span>
            <span className="text-lg text-muted-foreground">—</span>
            <span className="text-lg font-semibold">{type.name}</span>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all duration-200"
            title="Delete service type"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="glass rounded-2xl p-4 space-y-0">
        <InlineField label="Code" field="code" value={type.code} id={type.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Name" field="name" value={type.name} id={type.id} onSaved={onFieldUpdated} />
        <InlineField label="Description" field="description" value={type.description || ''} id={type.id} onSaved={onFieldUpdated} />
        <ColorField label="Color" value={type.color || '#6b7280'} id={type.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Active" field="is_active" value={type.is_active} id={type.id} onSaved={onFieldUpdated} />
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete {type.code} — {type.name}?
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
    const result = await updateFlightServiceTypeField(id, field, editValue || null)
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
    const result = await updateFlightServiceTypeField(id, field, checked)
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

function ColorField({
  label, value, id, onSaved,
}: {
  label: string; value: string; id: string; onSaved: () => void
}) {
  const [flashClass, setFlashClass] = useState('')

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value
    const result = await updateFlightServiceTypeField(id, 'color', newColor)
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
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono text-muted-foreground">{value}</span>
        <input
          type="color"
          value={value}
          onChange={handleChange}
          className="h-7 w-10 rounded cursor-pointer border-0 bg-transparent"
        />
      </div>
    </div>
  )
}

// ─── Add Dialog ─────────────────────────────────────────────────────────

function AddServiceTypeDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await createFlightServiceType(formData)
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
          <DialogTitle>Add Flight Service Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Code *</label>
              <Input name="code" required className="h-8 text-sm mt-1 font-mono" placeholder="J" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <Input name="color" type="color" defaultValue="#3b82f6" className="h-8 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Name *</label>
            <Input name="name" required className="h-8 text-sm mt-1" placeholder="Scheduled Passenger" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input name="description" className="h-8 text-sm mt-1" placeholder="Regular scheduled passenger service" />
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
