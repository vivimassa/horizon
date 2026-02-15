'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { DelayCode } from '@/types/database'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import {
  updateDelayCodeField,
  createDelayCode,
  deleteDelayCode,
} from '@/app/actions/delay-codes'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Trash2,
  Search,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Constants ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Passenger & Baggage',
  'Cargo & Mail',
  'Aircraft & Ramp',
  'Technical & Equipment',
  'Damage & EDP/Automated',
  'Operations & Crew',
  'Weather',
  'ATFM & Airport',
  'Reactionary',
  'Miscellaneous',
] as const

const CATEGORY_COLORS: Record<string, string> = {
  'Passenger & Baggage': 'bg-blue-500',
  'Cargo & Mail': 'bg-amber-500',
  'Aircraft & Ramp': 'bg-purple-500',
  'Technical & Equipment': 'bg-red-500',
  'Damage & EDP/Automated': 'bg-orange-500',
  'Operations & Crew': 'bg-emerald-500',
  'Weather': 'bg-cyan-500',
  'ATFM & Airport': 'bg-pink-500',
  'Reactionary': 'bg-yellow-500',
  'Miscellaneous': 'bg-gray-500',
}

// ─── Props ──────────────────────────────────────────────────────────────

interface Props {
  delayCodes: DelayCode[]
}

// ─── Main Component ─────────────────────────────────────────────────────

export function DelayCodesMasterDetail({ delayCodes: initial }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<DelayCode | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [showAddDialog, setShowAddDialog] = useState(false)

  const codes = initial

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  useEffect(() => {
    if (selected) {
      const updated = codes.find(c => c.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [codes, selected])

  const filtered = useMemo(() => {
    if (!search) return codes
    const q = search.toLowerCase()
    return codes.filter(c =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    )
  }, [codes, search])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, DelayCode[]> = {}
    for (const cat of CATEGORIES) groups[cat] = []
    for (const c of filtered) {
      const cat = c.category || 'Miscellaneous'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(c)
    }
    return Object.entries(groups).filter(([, items]) => items.length > 0)
  }, [filtered])

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const renderListHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Delay Codes</h2>
          <Badge variant="secondary" className="text-[10px]">{codes.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search delay codes..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs pl-9"
        />
      </div>
    </div>
  )

  const renderListBody = (renderItem: (item: DelayCode) => React.ReactNode) => (
    <>
      {grouped.map(([category, items]) => {
        const isCollapsed = collapsed[category]
        const dotColor = CATEGORY_COLORS[category] || 'bg-gray-500'
        return (
          <div key={category}>
            <button
              onClick={() => toggleGroup(category)}
              className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-200', !isCollapsed && 'rotate-90')} />
              <div className={cn('h-2 w-2 rounded-full shrink-0', dotColor)} />
              <span>{category}</span>
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

  const renderListItem = (code: DelayCode, isSelected: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn('font-mono text-sm font-bold shrink-0', isSelected ? 'text-primary' : 'text-foreground')}>
        {code.code}
      </span>
      <span className="text-sm truncate text-muted-foreground">{code.name}</span>
      {code.is_iata_standard && (
        <Badge variant="secondary" className="text-[9px] shrink-0 px-1 py-0">IATA</Badge>
      )}
    </div>
  )

  const renderCompactListItem = (code: DelayCode) => (
    <div className="text-center">
      <div className="font-mono text-[10px] font-bold">{code.code}</div>
    </div>
  )

  const renderDetail = (code: DelayCode) => (
    <DetailPanel code={code} onFieldUpdated={refresh} onDeleted={() => { setSelected(null); refresh() }} />
  )

  return (
    <>
      <MasterDetailLayout<DelayCode>
        items={filtered}
        selectedItem={selected}
        onSelectItem={setSelected}
        keyExtractor={c => c.id}
        renderListItem={renderListItem}
        renderCompactListItem={renderCompactListItem}
        renderDetail={renderDetail}
        renderListHeader={renderListHeader}
        renderListBody={renderListBody}
        className="h-full"
      />
      {showAddDialog && (
        <AddDelayCodeDialog open={showAddDialog} onClose={() => setShowAddDialog(false)} onCreated={refresh} />
      )}
    </>
  )
}

// ─── Detail Panel ───────────────────────────────────────────────────────

function DetailPanel({
  code, onFieldUpdated, onDeleted,
}: {
  code: DelayCode
  onFieldUpdated: () => void
  onDeleted: () => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    const result = await deleteDelayCode(code.id)
    setDeleting(false)
    if (result?.error) {
      alert(result.error)
      setShowDeleteConfirm(false)
    } else {
      setShowDeleteConfirm(false)
      onDeleted()
    }
  }

  const catColor = CATEGORY_COLORS[code.category] || 'bg-gray-500'

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="shrink-0 mb-4 glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-2xl font-bold">{code.code}</span>
              <span className="text-lg text-muted-foreground">—</span>
              <span className="text-lg font-semibold">{code.name}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className={cn('h-2.5 w-2.5 rounded-full', catColor)} />
              <span className="text-sm text-muted-foreground">{code.category}</span>
              {code.is_iata_standard && (
                <Badge variant="secondary" className="text-xs">IATA Standard</Badge>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 rounded-xl hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all duration-200"
            title="Delete delay code"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Editable Fields */}
      <div className="glass rounded-2xl p-4 space-y-0">
        <InlineField label="Code" field="code" value={code.code} id={code.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Name" field="name" value={code.name} id={code.id} onSaved={onFieldUpdated} />
        <InlineSelect label="Category" field="category" value={code.category} id={code.id} options={CATEGORIES} onSaved={onFieldUpdated} />
        <InlineField label="Description" field="description" value={code.description || ''} id={code.id} onSaved={onFieldUpdated} />
        <InlineToggle label="IATA Standard" field="is_iata_standard" value={code.is_iata_standard} id={code.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Active" field="is_active" value={code.is_active} id={code.id} onSaved={onFieldUpdated} />
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Delete {code.code} — {code.name}?
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
    const result = await updateDelayCodeField(id, field, editValue || null)
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

function InlineSelect({
  label, field, value, id, options, onSaved,
}: {
  label: string; field: string; value: string; id: string; options: readonly string[]; onSaved: () => void
}) {
  const [flashClass, setFlashClass] = useState('')

  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    const result = await updateDelayCodeField(id, field, newValue)
    if (result?.error) {
      alert(result.error)
    } else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5', flashClass)}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Select value={value || ''} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
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
    const result = await updateDelayCodeField(id, field, checked)
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

// ─── Add Dialog ─────────────────────────────────────────────────────────

function AddDelayCodeDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await createDelayCode(formData)
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
          <DialogTitle>Add Delay Code</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Code *</label>
              <Input name="code" required className="h-8 text-sm mt-1 font-mono" placeholder="11" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category *</label>
              <select name="category" required className="h-8 text-sm mt-1 w-full rounded-md border border-input bg-background px-3">
                <option value="">Select...</option>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Name *</label>
            <Input name="name" required className="h-8 text-sm mt-1" placeholder="Late Check-in" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <Input name="description" className="h-8 text-sm mt-1" placeholder="Passenger checked in late" />
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
