'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CabinClass } from '@/types/database'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import {
  updateCabinClassField,
  createCabinClass,
  deleteCabinClass,
} from '@/app/actions/cabin-classes'
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
  cabinClasses: CabinClass[]
}

// ─── Main Component ─────────────────────────────────────────────────────

export function CabinClassesMasterDetail({ cabinClasses: initial }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<CabinClass | null>(null)
  const [search, setSearch] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)

  const classes = initial

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    if (selected) {
      const updated = classes.find(c => c.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [classes, selected])

  const filtered = useMemo(() => {
    if (!search) return classes
    const q = search.toLowerCase()
    return classes.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q)
    )
  }, [classes, search])

  const renderListHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Cabin Classes</h2>
          <Badge variant="secondary" className="text-[10px]">{classes.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search cabin classes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs pl-9"
        />
      </div>
    </div>
  )

  const renderListItem = (cls: CabinClass, isSelected: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="h-3 w-3 rounded-full shrink-0 border border-white/20"
        style={{ backgroundColor: cls.color || '#6b7280' }}
      />
      <span className={cn('font-mono text-sm font-bold shrink-0', isSelected ? 'text-primary' : 'text-foreground')}>
        {cls.code}
      </span>
      <span className="text-sm truncate text-muted-foreground">{cls.name}</span>
      {cls.sort_order !== null && (
        <span className="text-[10px] text-muted-foreground/50 font-mono shrink-0 ml-auto">#{cls.sort_order}</span>
      )}
    </div>
  )

  const renderCompactListItem = (cls: CabinClass) => (
    <div className="text-center">
      <div
        className="h-2.5 w-2.5 rounded-full mx-auto mb-0.5 border border-white/20"
        style={{ backgroundColor: cls.color || '#6b7280' }}
      />
      <div className="font-mono text-[10px] font-bold">{cls.code}</div>
    </div>
  )

  const renderDetail = (cls: CabinClass) => (
    <DetailPanel cls={cls} onFieldUpdated={refresh} onDeleted={() => { setSelected(null); refresh() }} />
  )

  return (
    <>
      <MasterDetailLayout<CabinClass>
        items={filtered}
        selectedItem={selected}
        onSelectItem={setSelected}
        keyExtractor={c => c.id}
        renderListItem={renderListItem}
        renderCompactListItem={renderCompactListItem}
        renderDetail={renderDetail}
        renderListHeader={renderListHeader}
        className="h-full"
      />
      {showAddDialog && (
        <AddCabinClassDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onCreated={refresh} />
      )}
    </>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────

function DetailPanel({
  cls, onFieldUpdated, onDeleted,
}: {
  cls: CabinClass
  onFieldUpdated: () => void
  onDeleted: () => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteCabinClass(cls.id)
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
              className="h-6 w-6 rounded-full border border-white/20"
              style={{ backgroundColor: cls.color || '#6b7280' }}
            />
            <span className="font-mono text-2xl font-bold">{cls.code}</span>
            <span className="text-lg text-muted-foreground">—</span>
            <span className="text-lg font-semibold">{cls.name}</span>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all duration-200"
            title="Delete cabin class"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="glass rounded-2xl p-4 space-y-0">
        <InlineField label="Code" field="code" value={cls.code} id={cls.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Name" field="name" value={cls.name} id={cls.id} onSaved={onFieldUpdated} />
        <InlineNumberField label="Sort Order" field="sort_order" value={cls.sort_order} id={cls.id} onSaved={onFieldUpdated} />
        <ColorField label="Color" value={cls.color || '#6b7280'} id={cls.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Active" field="is_active" value={cls.is_active} id={cls.id} onSaved={onFieldUpdated} />
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete {cls.code} — {cls.name}?
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
    const result = await updateCabinClassField(id, field, editValue || null)
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

function InlineNumberField({
  label, field, value, id, onSaved,
}: {
  label: string; field: string; value: number | null; id: string; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [flashClass, setFlashClass] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value?.toString() || '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = useCallback(async () => {
    const numVal = editValue ? parseInt(editValue) : null
    if (numVal === value) { setEditing(false); return }
    setSaving(true)
    const result = await updateCabinClassField(id, field, numVal)
    setSaving(false)
    if (result?.error) {
      alert(result.error)
      setEditValue(value?.toString() || '')
    } else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
    setEditing(false)
  }, [id, field, editValue, value, onSaved])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditValue(value?.toString() || ''); setEditing(false) }
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
          type="number"
          className="h-8 text-sm"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px]',
            value === null && 'text-muted-foreground italic'
          )}
        >
          {value !== null ? value.toString() : '—'}
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
    const result = await updateCabinClassField(id, field, checked)
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
    const result = await updateCabinClassField(id, 'color', newColor)
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

function AddCabinClassDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await createCabinClass(formData)
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
          <DialogTitle>Add Cabin Class</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Code *</label>
              <Input name="code" required className="h-8 text-sm mt-1 font-mono" placeholder="Y" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Sort Order</label>
              <Input name="sort_order" type="number" className="h-8 text-sm mt-1" placeholder="4" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Color</label>
              <Input name="color" type="color" defaultValue="#22c55e" className="h-8 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Name *</label>
            <Input name="name" required className="h-8 text-sm mt-1" placeholder="Economy" />
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
