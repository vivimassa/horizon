'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { AircraftType, AircraftSeatingConfig, Airport } from '@/types/database'
import {
  AircraftWithRelations,
  updateAircraftField,
  createAircraftRegistration,
  deleteAircraftRegistration,
  uploadAircraftImage,
  removeAircraftImage,
  createAircraftSeatingConfig,
  updateAircraftSeatingConfig,
  deleteAircraftSeatingConfig,
} from '@/app/actions/aircraft-registrations'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
  Plus, Trash2, Search, Plane, Info, X, ChevronRight,
  Upload, Pencil, Calendar, AlertTriangle, Settings2,
  Gauge, Activity, ImageIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────

interface CabinEntry { class: string; seats: number }

interface Props {
  aircraft: AircraftWithRelations[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
  seatingConfigs: AircraftSeatingConfig[]
}

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
  active: { color: 'text-emerald-500', dot: 'bg-emerald-500', label: 'Active' },
  maintenance: { color: 'text-amber-500', dot: 'bg-amber-500', label: 'Maintenance' },
  storage: { color: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Storage' },
  retired: { color: 'text-red-500', dot: 'bg-red-500', label: 'Retired' },
}

const CABIN_CLASS_COLORS: Record<string, string> = {
  F: '#d97706',
  J: '#3b82f6',
  W: '#8b5cf6',
  Y: '#22c55e',
}

const REST_FACILITY_CLASSES = ['None', 'Class 1', 'Class 2', 'Class 3'] as const

// ─── Main Component ─────────────────────────────────────────────────────

export function AircraftRegistrationsMasterDetail({
  aircraft: initial, aircraftTypes, airports, seatingConfigs: initialConfigs,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<AircraftWithRelations | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState('basic')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [configs, setConfigs] = useState<AircraftSeatingConfig[]>(initialConfigs)

  const aircraft = initial

  const refresh = useCallback(() => { router.refresh() }, [router])

  useEffect(() => {
    if (selected) {
      const updated = aircraft.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [aircraft, selected])

  useEffect(() => { setConfigs(initialConfigs) }, [initialConfigs])

  // Filter
  const filtered = useMemo(() => {
    if (!search) return aircraft
    const q = search.toLowerCase()
    return aircraft.filter(a =>
      a.registration.toLowerCase().includes(q) ||
      (a.aircraft_types?.icao_type || '').toLowerCase().includes(q) ||
      (a.aircraft_types?.name || '').toLowerCase().includes(q) ||
      (a.serial_number || '').toLowerCase().includes(q) ||
      (a.status || '').toLowerCase().includes(q)
    )
  }, [aircraft, search])

  // Group by aircraft type
  const typeGroups = useMemo(() => {
    const groups: Record<string, { label: string; items: AircraftWithRelations[] }> = {}
    for (const a of filtered) {
      const typeId = a.aircraft_type_id
      const typeInfo = a.aircraft_types
      const key = typeId
      if (!groups[key]) {
        groups[key] = {
          label: typeInfo ? `${typeInfo.icao_type} — ${typeInfo.name}` : 'Unknown Type',
          items: [],
        }
      }
      groups[key].items.push(a)
    }
    // Sort groups by label
    return Object.entries(groups).sort((a, b) => a[1].label.localeCompare(b[1].label))
  }, [filtered])

  const toggleGroup = (key: string) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const selectedConfigs = useMemo(() => {
    if (!selected) return []
    return configs.filter(c => c.aircraft_id === selected.id)
  }, [selected, configs])

  // ─── List Header ───────────────────────────────────────────────────

  const renderListHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Registrations</h2>
          <Badge variant="secondary" className="text-[10px]">{aircraft.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search registration, type, MSN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs pl-9"
        />
      </div>
    </div>
  )

  // ─── List Body ─────────────────────────────────────────────────────

  const renderListBody = (renderItem: (item: AircraftWithRelations) => React.ReactNode) => (
    <>
      {typeGroups.map(([key, group]) => {
        const isCollapsed = collapsed[key]
        return (
          <div key={key}>
            <button
              onClick={() => toggleGroup(key)}
              className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-200', !isCollapsed && 'rotate-90')} />
              <span className="truncate">{group.label}</span>
              <span className="text-muted-foreground/40">({group.items.length})</span>
              <div className="flex-1 h-px bg-border/50 ml-1" />
            </button>
            <div className={cn('region-collapse', !isCollapsed && 'expanded')}>
              <div className="space-y-0.5">
                {group.items.map(item => renderItem(item))}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )

  // ─── List Item ─────────────────────────────────────────────────────

  const renderListItem = (ac: AircraftWithRelations, isSelected: boolean) => {
    const status = STATUS_CONFIG[ac.status] || STATUS_CONFIG.active
    const homeBase = ac.home_base
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className={cn('h-2 w-2 rounded-full shrink-0', status.dot)} />
        <span className={cn('font-mono text-sm font-bold shrink-0', isSelected ? 'text-primary' : 'text-foreground')}>
          {ac.registration}
        </span>
        {homeBase?.iata_code && (
          <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{homeBase.iata_code}</span>
        )}
      </div>
    )
  }

  const renderCompactListItem = (ac: AircraftWithRelations) => (
    <div className="text-center">
      <div className="font-mono text-[10px] font-bold">{ac.registration}</div>
    </div>
  )

  // ─── Detail ────────────────────────────────────────────────────────

  const renderDetail = (ac: AircraftWithRelations) => (
    <DetailPanel
      ac={ac}
      configs={selectedConfigs}
      aircraftTypes={aircraftTypes}
      airports={airports}
      onFieldUpdated={refresh}
      onConfigsChanged={(newConfigs) => {
        setConfigs(prev => {
          const others = prev.filter(c => c.aircraft_id !== ac.id)
          return [...others, ...newConfigs]
        })
        refresh()
      }}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onDeleted={() => { setSelected(null); refresh() }}
    />
  )

  return (
    <>
      <MasterDetailLayout<AircraftWithRelations>
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
        <AddRegistrationDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onCreated={refresh}
          aircraftTypes={aircraftTypes}
          airports={airports}
        />
      )}
    </>
  )
}

// ─── Detail Panel ────────────────────────────────────────────────────────

function DetailPanel({
  ac, configs, aircraftTypes, airports, onFieldUpdated, onConfigsChanged,
  activeTab, onTabChange, onDeleted,
}: {
  ac: AircraftWithRelations
  configs: AircraftSeatingConfig[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
  onFieldUpdated: () => void
  onConfigsChanged: (configs: AircraftSeatingConfig[]) => void
  activeTab: string
  onTabChange: (tab: string) => void
  onDeleted: () => void
}) {
  const [deleteState, setDeleteState] = useState<'idle' | 'confirm'>('idle')
  const [deleting, setDeleting] = useState(false)

  const status = STATUS_CONFIG[ac.status] || STATUS_CONFIG.active
  const typeInfo = ac.aircraft_types
  const heroImage = ac.image_url || typeInfo?.image_url || null

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const result = await deleteAircraftRegistration(ac.id)
    setDeleting(false)
    if (result?.error) {
      alert(result.error)
      setDeleteState('idle')
    } else {
      setDeleteState('idle')
      onDeleted()
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Hero Image */}
      <div className="shrink-0 mb-3 relative rounded-2xl overflow-hidden" style={{ height: '35%', minHeight: '160px' }}>
        {heroImage ? (
          <img src={heroImage} alt={ac.registration} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center gap-2">
            <Plane className="h-12 w-12 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground/50">No image available</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Upload/Remove photo */}
        <ImageUploadButton acId={ac.id} hasCustomImage={!!ac.image_url} onUpdated={onFieldUpdated} />

        {/* Info overlay */}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <div className="text-white font-mono font-bold text-xl leading-tight">
              {ac.registration}
            </div>
            <div className="text-white/70 text-sm">
              {typeInfo ? `${typeInfo.icao_type} — ${typeInfo.name}` : 'Unknown Type'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn('text-[10px] border-0', {
              'bg-emerald-500/20 text-emerald-300': ac.status === 'active',
              'bg-amber-500/20 text-amber-300': ac.status === 'maintenance',
              'bg-white/20 text-white/70': ac.status === 'storage',
              'bg-red-500/20 text-red-300': ac.status === 'retired',
            })}>
              {status.label}
            </Badge>
            {ac.home_base?.iata_code && (
              <span className="text-white/60 text-xs font-mono">{ac.home_base.iata_code}</span>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm */}
      <Dialog open={deleteState === 'confirm'} onOpenChange={() => setDeleteState('idle')}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {ac.registration}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteState('idle')} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tabs */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
          <TabsList className="glass shrink-0 justify-start flex-wrap">
            <TabsTrigger value="basic" className="text-xs gap-1"><Info className="h-3 w-3" /> Basic</TabsTrigger>
            <TabsTrigger value="configuration" className="text-xs gap-1"><Settings2 className="h-3 w-3" /> Configuration</TabsTrigger>
            <TabsTrigger value="performance" className="text-xs gap-1"><Gauge className="h-3 w-3" /> Performance Override</TabsTrigger>
            <TabsTrigger value="state" className="text-xs gap-1"><Activity className="h-3 w-3" /> Current State</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <BasicTab ac={ac} aircraftTypes={aircraftTypes} airports={airports} onSaved={onFieldUpdated} onDelete={() => setDeleteState('confirm')} />
          </TabsContent>
          <TabsContent value="configuration" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <ConfigurationTab ac={ac} configs={configs} onConfigsChanged={onConfigsChanged} />
          </TabsContent>
          <TabsContent value="performance" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <PerformanceOverrideTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="state" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <CurrentStateTab ac={ac} airports={airports} onSaved={onFieldUpdated} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Image Upload Button ─────────────────────────────────────────────────

function ImageUploadButton({ acId, hasCustomImage, onUpdated }: { acId: string; hasCustomImage: boolean; onUpdated: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    const result = await uploadAircraftImage(acId, formData)
    setUploading(false)
    if (result?.error) alert(result.error)
    else onUpdated()
  }

  const handleRemove = async () => {
    const result = await removeAircraftImage(acId)
    if (result?.error) alert(result.error)
    else onUpdated()
  }

  return (
    <div className="absolute top-3 right-3 flex items-center gap-2">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="p-2 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-sm text-white/70 hover:text-white transition-all duration-200"
        title="Upload photo"
      >
        {uploading ? <span className="h-4 w-4 block animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Upload className="h-4 w-4" />}
      </button>
      {hasCustomImage && (
        <button
          onClick={handleRemove}
          className="p-2 rounded-xl bg-black/30 hover:bg-destructive/80 backdrop-blur-sm text-white/70 hover:text-white transition-all duration-200"
          title="Remove photo"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ─── Inline Edit Helpers ─────────────────────────────────────────────────

function InlineField({
  label, field, value, acId, onSaved, mono, type = 'text', suffix, inputType,
}: {
  label: string; field: string; value: string; acId: string; onSaved: () => void
  mono?: boolean; type?: string; suffix?: string; inputType?: string
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = useCallback(async () => {
    if (editValue === value) { setEditing(false); return }
    setSaving(true)
    const finalValue = type === 'number' ? (editValue ? parseFloat(editValue) : null) : (editValue || null)
    const result = await updateAircraftField(acId, field, finalValue)
    setSaving(false)
    if (result?.error) {
      alert(result.error)
      setEditValue(value)
    } else {
      onSaved()
    }
    setEditing(false)
  }, [acId, field, editValue, value, onSaved, type])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditValue(value); setEditing(false) }
  }

  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={saving}
            type={inputType || type}
            step={type === 'number' ? 'any' : undefined}
            className={cn('h-8 text-sm flex-1', mono && 'font-mono')}
          />
          {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px] flex items-center gap-2',
            mono && 'font-mono',
            !value && 'text-muted-foreground italic'
          )}
        >
          <span>{value || '—'}</span>
          {suffix && value && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </button>
      )}
    </div>
  )
}

function InlineSelectField({
  label, field, value, acId, options, onSaved, displayMap,
}: {
  label: string; field: string; value: string; acId: string
  options: { value: string; label: string }[]; onSaved: () => void
  displayMap?: Record<string, { color?: string }>
}) {
  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    const result = await updateAircraftField(acId, field, newValue)
    if (result?.error) alert(result.error)
    else {
      onSaved()
    }
  }

  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Select value={value || ''} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className={displayMap?.[opt.value]?.color}>{opt.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function InlineDateField({
  label, field, value, acId, onSaved, warningFn,
}: {
  label: string; field: string; value: string; acId: string; onSaved: () => void
  warningFn?: (val: string) => { type: 'amber' | 'red'; text: string } | null
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = async () => {
    if (editValue === value) { setEditing(false); return }
    const result = await updateAircraftField(acId, field, editValue || null)
    if (result?.error) {
      alert(result.error)
      setEditValue(value)
    } else {
      onSaved()
    }
    setEditing(false)
  }

  const warning = warningFn && value ? warningFn(value) : null

  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <Input
          ref={inputRef}
          type="date"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="h-8 text-sm"
        />
      ) : (
        <div>
          <button
            onClick={() => setEditing(true)}
            className={cn(
              'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px] flex items-center gap-2',
              !value && 'text-muted-foreground italic'
            )}
          >
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span>{value || '—'}</span>
          </button>
          {warning && (
            <div className={cn('mt-1 text-[11px] flex items-center gap-1', warning.type === 'red' ? 'text-red-500' : 'text-amber-500')}>
              <AlertTriangle className="h-3 w-3" /> {warning.text}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InlineTextarea({
  label, field, value, acId, onSaved,
}: {
  label: string; field: string; value: string; acId: string; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  const save = async () => {
    if (editValue === value) { setEditing(false); return }
    const result = await updateAircraftField(acId, field, editValue || null)
    if (result?.error) alert(result.error)
    else onSaved()
    setEditing(false)
  }

  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <Textarea ref={ref} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={save} rows={3} className="text-sm" />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn('text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[60px]', !value && 'text-muted-foreground italic')}
        >
          {value || 'Click to add notes...'}
        </button>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">{title}</h3>
      {children}
    </div>
  )
}

// ─── TAB 1: BASIC INFO ──────────────────────────────────────────────────

function BasicTab({ ac, aircraftTypes, airports, onSaved, onDelete }: {
  ac: AircraftWithRelations; aircraftTypes: AircraftType[]; airports: Airport[]
  onSaved: () => void; onDelete: () => void
}) {
  const leaseWarning = (val: string): { type: 'amber' | 'red'; text: string } | null => {
    if (!val) return null
    const d = new Date(val)
    const now = new Date()
    const sixMonths = new Date()
    sixMonths.setMonth(sixMonths.getMonth() + 6)
    if (d < now) return { type: 'red', text: 'Lease expired' }
    if (d < sixMonths) return { type: 'amber', text: 'Lease expires soon' }
    return null
  }

  const typeOptions = aircraftTypes.map(t => ({ value: t.id, label: `${t.icao_type} — ${t.name}` }))
  const airportOptions = airports.filter(a => a.is_active).map(a => ({
    value: a.id,
    label: `${a.iata_code || a.icao_code} — ${a.name}`,
  }))

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'storage', label: 'Storage' },
    { value: 'retired', label: 'Retired' },
  ]

  return (
    <div className="space-y-4">
      <Section title="Identity">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="Registration" field="registration" value={ac.registration} acId={ac.id} onSaved={onSaved} mono />
          <InlineSelectField label="Aircraft Type" field="aircraft_type_id" value={ac.aircraft_type_id} acId={ac.id} options={typeOptions} onSaved={onSaved} />
          <InlineField label="Serial Number (MSN)" field="serial_number" value={ac.serial_number || ''} acId={ac.id} onSaved={onSaved} mono />
          <InlineField label="Sub-operator" field="sub_operator" value={ac.sub_operator || ''} acId={ac.id} onSaved={onSaved} />
        </div>
      </Section>

      <Section title="Status & Location">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineSelectField
            label="Status" field="status" value={ac.status} acId={ac.id}
            options={statusOptions} onSaved={onSaved}
            displayMap={{
              active: { color: 'text-emerald-500' },
              maintenance: { color: 'text-amber-500' },
              storage: { color: 'text-muted-foreground' },
              retired: { color: 'text-red-500' },
            }}
          />
          <InlineSelectField label="Home Base" field="home_base_id" value={ac.home_base_id || ''} acId={ac.id} options={airportOptions} onSaved={onSaved} />
        </div>
      </Section>

      <Section title="Dates">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineDateField label="Date of Manufacture" field="date_of_manufacture" value={ac.date_of_manufacture || ''} acId={ac.id} onSaved={onSaved} />
          <InlineDateField label="Date of Delivery" field="date_of_delivery" value={ac.date_of_delivery || ''} acId={ac.id} onSaved={onSaved} />
          <InlineDateField label="Lease Expiry Date" field="lease_expiry_date" value={ac.lease_expiry_date || ''} acId={ac.id} onSaved={onSaved} warningFn={leaseWarning} />
        </div>
      </Section>

      <Section title="Notes">
        <InlineTextarea label="Notes" field="notes" value={ac.notes || ''} acId={ac.id} onSaved={onSaved} />
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive gap-1" onClick={onDelete}>
            <Trash2 className="h-3 w-3" /> Delete Registration
          </Button>
        </div>
      </Section>
    </div>
  )
}

// ─── TAB 2: CONFIGURATION ───────────────────────────────────────────────

function ConfigurationTab({ ac, configs, onConfigsChanged }: {
  ac: AircraftWithRelations; configs: AircraftSeatingConfig[]; onConfigsChanged: (c: AircraftSeatingConfig[]) => void
}) {
  const [showAddConfig, setShowAddConfig] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AircraftSeatingConfig | null>(null)
  const router = useRouter()

  const today = new Date().toISOString().split('T')[0]

  const getConfigStatus = (c: AircraftSeatingConfig) => {
    if (c.effective_from > today) return 'future'
    if (c.effective_to && c.effective_to < today) return 'past'
    return 'active'
  }

  const handleDelete = async (id: string) => {
    if (configs.length <= 1) {
      alert('At least one configuration must exist.')
      return
    }
    const result = await deleteAircraftSeatingConfig(id)
    if (result?.error) alert(result.error)
    else onConfigsChanged(configs.filter(c => c.id !== id))
  }

  const handleConfigSaved = () => {
    setShowAddConfig(false)
    setEditingConfig(null)
    router.refresh()
  }

  // Sort configs by effective_from
  const sortedConfigs = [...configs].sort((a, b) => a.effective_from.localeCompare(b.effective_from))

  // Timeline calculation
  const timelineSegments = useMemo(() => {
    if (sortedConfigs.length === 0) return []
    const now = new Date()
    const earliest = new Date(sortedConfigs[0].effective_from)
    const latest = sortedConfigs[sortedConfigs.length - 1].effective_to
      ? new Date(sortedConfigs[sortedConfigs.length - 1].effective_to!)
      : new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    const totalDays = Math.max(1, (latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24))

    return sortedConfigs.map(c => {
      const start = new Date(c.effective_from)
      const end = c.effective_to ? new Date(c.effective_to) : latest
      const days = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const pct = Math.max(5, (days / totalDays) * 100)
      const status = getConfigStatus(c)
      const cabins = (c.cabin_config as unknown as CabinEntry[]) || []
      const label = cabins.map(cb => `${cb.class}:${cb.seats}`).join('/')
      return { id: c.id, name: c.config_name, pct, status, label, from: c.effective_from, to: c.effective_to }
    })
  }, [sortedConfigs])

  return (
    <div className="space-y-4">
      {/* Info banner when no configs */}
      {configs.length === 0 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            Using Aircraft Type default configuration. Add a configuration to override for this specific aircraft.
          </div>
        </div>
      )}

      {/* Timeline */}
      {timelineSegments.length > 0 && (
        <Section title="Configuration Timeline">
          <div className="flex rounded-lg overflow-hidden h-14">
            {timelineSegments.map(seg => (
              <div
                key={seg.id}
                className={cn(
                  'flex flex-col items-center justify-center px-2 text-white text-[10px] font-medium cursor-pointer transition-opacity hover:opacity-90',
                  seg.status === 'active' && 'bg-emerald-600',
                  seg.status === 'past' && 'bg-gray-500',
                  seg.status === 'future' && 'bg-blue-500',
                )}
                style={{ width: `${seg.pct}%`, minWidth: '60px' }}
                title={`${seg.name}: ${seg.from} → ${seg.to || 'Current'}\n${seg.label}`}
              >
                <span className="truncate w-full text-center font-semibold">{seg.name}</span>
                <span className="truncate w-full text-center opacity-70">{seg.label}</span>
                <span className="truncate w-full text-center opacity-50">{seg.from}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Config table */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Seating Configurations</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddConfig(true)}>
          <Plus className="h-3 w-3" /> Add Configuration
        </Button>
      </div>

      {sortedConfigs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No configurations defined.</div>
      ) : (
        <div className="space-y-3">
          {sortedConfigs.map(config => {
            const cabins = (config.cabin_config as unknown as CabinEntry[]) || []
            const total = cabins.reduce((s, c) => s + c.seats, 0)
            const status = getConfigStatus(config)

            return (
              <div key={config.id} className="glass rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className={cn('text-[10px]', {
                      'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400': status === 'active',
                      'bg-muted text-muted-foreground': status === 'past',
                      'bg-blue-500/15 text-blue-600 dark:text-blue-400': status === 'future',
                    })}>
                      {status === 'active' ? '✅ Active' : status === 'future' ? 'Future' : 'Past'}
                    </Badge>
                    <span className="text-sm font-semibold">{config.config_name}</span>
                    <span className="text-xs text-muted-foreground">{total} seats</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingConfig(config)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-destructive" onClick={() => handleDelete(config.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Date range */}
                <div className="text-[11px] text-muted-foreground">
                  {config.effective_from} → {config.effective_to || 'Current'}
                </div>

                {/* Cabin bar */}
                {total > 0 && (
                  <div className="flex rounded-lg overflow-hidden h-7">
                    {cabins.map((cab, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center text-white text-[10px] font-bold"
                        style={{
                          width: `${(cab.seats / total) * 100}%`,
                          backgroundColor: CABIN_CLASS_COLORS[cab.class] || '#6b7280',
                          minWidth: '40px',
                        }}
                      >
                        {cab.class}:{cab.seats}
                      </div>
                    ))}
                  </div>
                )}

                {/* Rest facility */}
                {(config.cockpit_rest_facility_class || config.cabin_rest_facility_class) && (
                  <div className="text-[11px] text-muted-foreground">
                    {config.cockpit_rest_facility_class && `Cockpit: ${config.cockpit_rest_facility_class}`}
                    {config.cockpit_rest_facility_class && config.cabin_rest_facility_class && ' | '}
                    {config.cabin_rest_facility_class && `Cabin: ${config.cabin_rest_facility_class}`}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add/Edit dialog */}
      {(showAddConfig || editingConfig) && (
        <SeatingConfigDialog
          open={true}
          onClose={() => { setShowAddConfig(false); setEditingConfig(null) }}
          aircraftId={ac.id}
          existing={editingConfig}
          onSaved={handleConfigSaved}
          existingConfigs={configs}
        />
      )}
    </div>
  )
}

// ─── TAB 3: PERFORMANCE OVERRIDE ────────────────────────────────────────

function PerformanceOverrideTab({ ac, onSaved }: { ac: AircraftWithRelations; onSaved: () => void }) {
  const typeInfo = ac.aircraft_types

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          Only fill in if this specific aircraft differs from the type standard.
          Leave blank to inherit from <span className="font-semibold text-foreground">{typeInfo ? `${typeInfo.icao_type} — ${typeInfo.name}` : 'Unknown'}</span>.
        </div>
      </div>

      {/* Weight overrides */}
      <Section title="Weight Overrides">
        <div className="grid grid-cols-2 gap-x-6">
          <OverrideField
            label="MTOW" suffix="kg" field="mtow_kg_override"
            typeDefault={typeInfo?.mtow_kg} overrideValue={ac.mtow_kg_override}
            acId={ac.id} onSaved={onSaved}
          />
          <OverrideField
            label="Range" suffix="NM" field="max_range_nm_override"
            typeDefault={typeInfo?.max_range_nm} overrideValue={ac.max_range_nm_override}
            acId={ac.id} onSaved={onSaved}
          />
        </div>
      </Section>

      {/* Rest Facility overrides */}
      <div className="grid grid-cols-2 gap-4">
        <Section title="Cockpit Rest Facility">
          <OverrideSelectField
            label="Facility Class" field="cockpit_rest_facility_class_override"
            typeDefault={typeInfo?.cockpit_rest_facility_class || 'None'}
            overrideValue={ac.cockpit_rest_facility_class_override}
            options={REST_FACILITY_CLASSES}
            acId={ac.id} onSaved={onSaved}
          />
          <OverrideField
            label="No. of Occupancy" field="cockpit_rest_positions_override"
            typeDefault={typeInfo?.cockpit_rest_positions} overrideValue={ac.cockpit_rest_positions_override}
            acId={ac.id} onSaved={onSaved}
          />
        </Section>

        <Section title="Cabin Rest Facility">
          <OverrideSelectField
            label="Facility Class" field="cabin_rest_facility_class_override"
            typeDefault={typeInfo?.cabin_rest_facility_class || 'None'}
            overrideValue={ac.cabin_rest_facility_class_override}
            options={REST_FACILITY_CLASSES}
            acId={ac.id} onSaved={onSaved}
          />
          <OverrideField
            label="No. of Occupancy" field="cabin_rest_positions_override"
            typeDefault={typeInfo?.cabin_rest_positions} overrideValue={ac.cabin_rest_positions_override}
            acId={ac.id} onSaved={onSaved}
          />
        </Section>
      </div>
    </div>
  )
}

function OverrideField({ label, suffix, field, typeDefault, overrideValue, acId, onSaved }: {
  label: string; suffix?: string; field: string
  typeDefault: number | null | undefined; overrideValue: number | null | undefined
  acId: string; onSaved: () => void
}) {
  const hasOverride = overrideValue !== null && overrideValue !== undefined
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(overrideValue?.toString() || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(overrideValue?.toString() || '') }, [overrideValue])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = async () => {
    const newVal = editValue ? parseFloat(editValue) : null
    if (newVal === overrideValue) { setEditing(false); return }
    const result = await updateAircraftField(acId, field, newVal)
    if (result?.error) alert(result.error)
    else {
      onSaved()
    }
    setEditing(false)
  }

  const clearOverride = async () => {
    const result = await updateAircraftField(acId, field, null)
    if (result?.error) alert(result.error)
    else onSaved()
  }

  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-[11px] text-muted-foreground/60 mb-1">
        Type default: {typeDefault != null ? `${typeDefault.toLocaleString()}${suffix ? ` ${suffix}` : ''}` : '—'}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="number"
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            className="h-8 text-sm flex-1"
            placeholder="Override value..."
          />
          {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
        </div>
      ) : hasOverride ? (
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="text-sm font-semibold text-primary px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10">
            {overrideValue!.toLocaleString()}{suffix ? ` ${suffix}` : ''}
          </button>
          <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">overridden</Badge>
          <button onClick={clearOverride} className="text-[10px] text-muted-foreground hover:text-foreground underline">inherit</button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-muted-foreground/50 italic px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10"
        >
          Inherit from type
        </button>
      )}
    </div>
  )
}

function OverrideSelectField({ label, field, typeDefault, overrideValue, options, acId, onSaved }: {
  label: string; field: string
  typeDefault: string; overrideValue: string | null | undefined
  options: readonly string[]; acId: string; onSaved: () => void
}) {
  const hasOverride = overrideValue !== null && overrideValue !== undefined

  const handleChange = async (newValue: string) => {
    const val = newValue === '__inherit__' ? null : newValue
    const result = await updateAircraftField(acId, field, val)
    if (result?.error) alert(result.error)
    else {
      onSaved()
    }
  }

  return (
    <div className="py-2.5 border-b border-white/5">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-[11px] text-muted-foreground/60 mb-1">
        Type default: {typeDefault}
      </div>
      <Select value={overrideValue || '__inherit__'} onValueChange={handleChange}>
        <SelectTrigger className={cn('h-8 text-sm', hasOverride && 'font-semibold text-primary')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__inherit__">
            <span className="text-muted-foreground italic">Inherit</span>
          </SelectItem>
          {options.map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasOverride && (
        <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary mt-1">overridden</Badge>
      )}
    </div>
  )
}

// ─── TAB 4: CURRENT STATE ───────────────────────────────────────────────

function CurrentStateTab({ ac, airports, onSaved }: {
  ac: AircraftWithRelations; airports: Airport[]; onSaved: () => void
}) {
  const airportOptions = airports.filter(a => a.is_active).map(a => ({
    value: a.id, label: `${a.iata_code || a.icao_code} — ${a.name}`,
  }))

  const maintenanceWarning = (val: string): { type: 'amber' | 'red'; text: string } | null => {
    if (!val) return null
    const d = new Date(val)
    const now = new Date()
    const thirtyDays = new Date()
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    if (d < now) return { type: 'red', text: 'OVERDUE' }
    if (d < thirtyDays) return { type: 'amber', text: 'Due within 30 days' }
    return null
  }

  return (
    <div className="space-y-4">
      {/* Info note */}
      <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          These values are automatically updated by the Operations module when flights are processed.
          Manual editing is available for initial setup.
        </div>
      </div>

      <Section title="Location & Hours">
        <InlineSelectField
          label="Current Location" field="current_location_id"
          value={ac.current_location_id || ''} acId={ac.id}
          options={airportOptions} onSaved={onSaved}
        />
        {ac.current_location_updated_at && (
          <div className="text-[11px] text-muted-foreground -mt-1 mb-2">
            Last updated: {new Date(ac.current_location_updated_at).toLocaleString()}
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="Flight Hours Total" field="flight_hours_total" value={ac.flight_hours_total?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="hrs" />
          <InlineField label="Cycles Total" field="cycles_total" value={ac.cycles_total?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" />
        </div>
      </Section>

      <Section title="Maintenance">
        <InlineDateField
          label="Next Maintenance Due" field="next_maintenance_due"
          value={ac.next_maintenance_due || ''} acId={ac.id} onSaved={onSaved}
          warningFn={maintenanceWarning}
        />
        <InlineDateField label="Last Maintenance" field="last_maintenance_date" value={ac.last_maintenance_date || ''} acId={ac.id} onSaved={onSaved} />
        <InlineField label="Last Maintenance Description" field="last_maintenance_description" value={ac.last_maintenance_description || ''} acId={ac.id} onSaved={onSaved} />
      </Section>

      <Section title="Version">
        <InlineField label="Aircraft Version" field="aircraft_version" value={ac.aircraft_version || ''} acId={ac.id} onSaved={onSaved} />
      </Section>
    </div>
  )
}

// ─── Seating Config Dialog ──────────────────────────────────────────────

function SeatingConfigDialog({
  open, onClose, aircraftId, existing, onSaved, existingConfigs,
}: {
  open: boolean; onClose: () => void; aircraftId: string
  existing: AircraftSeatingConfig | null; onSaved: () => void
  existingConfigs: AircraftSeatingConfig[]
}) {
  const [name, setName] = useState(existing?.config_name || '')
  const [effectiveFrom, setEffectiveFrom] = useState(existing?.effective_from || '')
  const [effectiveTo, setEffectiveTo] = useState(existing?.effective_to || '')
  const [cabins, setCabins] = useState<CabinEntry[]>(
    existing ? (existing.cabin_config as unknown as CabinEntry[]) : [{ class: 'Y', seats: 0 }]
  )
  const [cockpitRestClass, setCockpitRestClass] = useState(existing?.cockpit_rest_facility_class || '')
  const [cabinRestClass, setCabinRestClass] = useState(existing?.cabin_rest_facility_class || '')
  const [cockpitRestPos, setCockpitRestPos] = useState(existing?.cockpit_rest_positions?.toString() || '')
  const [cabinRestPos, setCabinRestPos] = useState(existing?.cabin_rest_positions?.toString() || '')
  const [notes, setNotes] = useState(existing?.notes || '')
  const [saving, setSaving] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState('')

  const total = cabins.reduce((s, c) => s + c.seats, 0)

  // Check overlap
  useEffect(() => {
    if (!effectiveFrom) { setOverlapWarning(''); return }
    const from = new Date(effectiveFrom)
    const to = effectiveTo ? new Date(effectiveTo) : new Date('2099-12-31')
    const overlap = existingConfigs.find(c => {
      if (existing && c.id === existing.id) return false
      const cFrom = new Date(c.effective_from)
      const cTo = c.effective_to ? new Date(c.effective_to) : new Date('2099-12-31')
      return from <= cTo && to >= cFrom
    })
    setOverlapWarning(overlap ? `Warning: overlaps with "${overlap.config_name}" (${overlap.effective_from} → ${overlap.effective_to || 'current'})` : '')
  }, [effectiveFrom, effectiveTo, existingConfigs, existing])

  const addCabin = () => setCabins(prev => [...prev, { class: 'Y', seats: 0 }])
  const removeCabin = (idx: number) => setCabins(prev => prev.filter((_, i) => i !== idx))
  const updateCabin = (idx: number, field: keyof CabinEntry, val: string | number) => {
    setCabins(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }

  const handleSave = async () => {
    if (!name.trim() || !effectiveFrom) return
    setSaving(true)
    const validCabins = cabins.filter(c => c.seats > 0)
    const data = {
      config_name: name,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || null,
      cabin_config: validCabins,
      cockpit_rest_facility_class: cockpitRestClass || null,
      cabin_rest_facility_class: cabinRestClass || null,
      cockpit_rest_positions: cockpitRestPos ? parseInt(cockpitRestPos) : null,
      cabin_rest_positions: cabinRestPos ? parseInt(cabinRestPos) : null,
      notes: notes || null,
    }

    let result
    if (existing) {
      result = await updateAircraftSeatingConfig(existing.id, data)
    } else {
      result = await createAircraftSeatingConfig(aircraftId, data)
    }

    setSaving(false)
    if (result?.error) alert(result.error)
    else { onSaved(); onClose() }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-heavy max-w-lg max-h-[85vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit' : 'Add'} Seating Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Config Name *</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm mt-1" placeholder="e.g. Two-class, All Economy" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Effective From *</label>
              <Input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Effective To (blank = current)</label>
              <Input type="date" value={effectiveTo} onChange={e => setEffectiveTo(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
          </div>

          {overlapWarning && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {overlapWarning}
            </div>
          )}

          {/* Cabin classes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Cabin Configuration</label>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={addCabin}>
                <Plus className="h-3 w-3" /> Add Cabin Class
              </Button>
            </div>
            {cabins.map((cab, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={cab.class} onValueChange={v => updateCabin(idx, 'class', v)}>
                  <SelectTrigger className="h-8 text-sm w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">F - First</SelectItem>
                    <SelectItem value="J">J - Business</SelectItem>
                    <SelectItem value="W">W - Premium</SelectItem>
                    <SelectItem value="Y">Y - Economy</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={cab.seats || ''}
                  onChange={e => updateCabin(idx, 'seats', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm flex-1"
                  placeholder="Seats"
                />
                {cabins.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => removeCabin(idx)}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
            <div className="text-xs text-muted-foreground text-right">Total: {total} seats</div>
          </div>

          {/* Rest facilities */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Cockpit Rest Facility Class</label>
              <Select value={cockpitRestClass || 'none'} onValueChange={v => setCockpitRestClass(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {REST_FACILITY_CLASSES.filter(c => c !== 'None').map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cabin Rest Facility Class</label>
              <Select value={cabinRestClass || 'none'} onValueChange={v => setCabinRestClass(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {REST_FACILITY_CLASSES.filter(c => c !== 'None').map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Cockpit No. of Occupancy</label>
              <Input type="number" value={cockpitRestPos} onChange={e => setCockpitRestPos(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cabin No. of Occupancy</label>
              <Input type="number" value={cabinRestPos} onChange={e => setCabinRestPos(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-sm mt-1" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !effectiveFrom}>
            {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Registration Dialog ────────────────────────────────────────────

function AddRegistrationDialog({
  open, onClose, onCreated, aircraftTypes, airports,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
  aircraftTypes: AircraftType[]; airports: Airport[]
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await createAircraftRegistration(formData)
    setSaving(false)
    if (result?.error) alert(result.error)
    else { onCreated(); onClose() }
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="glass-heavy max-w-md">
        <DialogHeader>
          <DialogTitle>Add Registration</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Registration *</label>
            <Input name="registration" required className="h-8 text-sm mt-1 font-mono" placeholder="VN-A661" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Aircraft Type *</label>
            <select name="aircraft_type_id" required className="h-8 text-sm mt-1 w-full rounded-md border border-input bg-background px-3">
              <option value="">Select...</option>
              {aircraftTypes.map(t => (
                <option key={t.id} value={t.id}>{t.icao_type} — {t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Serial Number (MSN)</label>
            <Input name="serial_number" className="h-8 text-sm mt-1 font-mono" placeholder="12345" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Home Base</label>
            <select name="home_base_id" className="h-8 text-sm mt-1 w-full rounded-md border border-input bg-background px-3">
              <option value="">Select...</option>
              {airports.filter(a => a.is_active).map(a => (
                <option key={a.id} value={a.id}>{a.iata_code || a.icao_code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Date of Manufacture</label>
              <Input type="date" name="date_of_manufacture" className="h-8 text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Date of Delivery</label>
              <Input type="date" name="date_of_delivery" className="h-8 text-sm mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <select name="status" className="h-8 text-sm mt-1 w-full rounded-md border border-input bg-background px-3">
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
              <option value="storage">Storage</option>
              <option value="retired">Retired</option>
            </select>
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
