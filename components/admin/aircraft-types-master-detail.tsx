'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { AircraftType, AircraftTypeSeatingConfig } from '@/types/database'
import { minutesToHHMM, hhmmToMinutes } from '@/lib/utils'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import {
  updateAircraftTypeField,
  createAircraftType,
  createSeatingConfig,
  updateSeatingConfig,
  deleteSeatingConfig,
  deleteAircraftType,
  getAircraftRegistrationCount,
} from '@/app/actions/aircraft-types'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
  Plus,
  Trash2,
  Search,
  Plane,
  Info,
  Check,
  X,
  ChevronRight,
  Upload,
  Image as ImageIcon,
  Gauge,
  Clock,
  Armchair,
  Package,
  Users,
  CloudRain,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// ─── Types ───────────────────────────────────────────────────────────────

interface CabinEntry { class: string; seats: number }

interface Props {
  aircraftTypes: AircraftType[]
  seatingConfigs: AircraftTypeSeatingConfig[]
}

const CATEGORIES = ['narrow_body', 'wide_body', 'regional', 'turboprop'] as const
const CATEGORY_LABELS: Record<string, string> = {
  narrow_body: 'Narrow-Body',
  wide_body: 'Wide-Body',
  regional: 'Regional Jet',
  turboprop: 'Turboprop',
}

const MANUFACTURERS = ['Airbus', 'Boeing', 'Embraer', 'ATR', 'Bombardier', 'Comac', 'Custom'] as const

const MANUFACTURER_LOGOS: Record<string, string> = {
  Airbus: '/images/manufacturers/airbus.svg',
  Boeing: '/images/manufacturers/boeing.svg',
  Embraer: '/images/manufacturers/embraer.svg',
  ATR: '/images/manufacturers/atr.svg',
  Bombardier: '/images/manufacturers/bombardier.svg',
  Comac: '/images/manufacturers/comac.svg',
}
const FIRE_CATEGORIES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
const WAKE_CATEGORIES = ['L', 'M', 'H', 'J'] as const
const ILS_CATEGORIES = ['None', 'Cat I', 'Cat II', 'Cat IIIa', 'Cat IIIb', 'Cat IIIc'] as const
const REST_FACILITY_CLASSES = ['None', 'Class 1', 'Class 2', 'Class 3'] as const

const CABIN_CLASS_COLORS: Record<string, string> = {
  F: '#d97706', // amber
  J: '#3b82f6', // blue
  W: '#8b5cf6', // violet
  Y: '#22c55e', // green
}

// ─── Main Component ─────────────────────────────────────────────────────

export function AircraftTypesMasterDetail({ aircraftTypes: initial, seatingConfigs: initialConfigs }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<AircraftType | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState('basic')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [configs, setConfigs] = useState<AircraftTypeSeatingConfig[]>(initialConfigs)

  const aircraftTypes = initial

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  // Update selected item when data refreshes
  useEffect(() => {
    if (selected) {
      const updated = aircraftTypes.find(a => a.id === selected.id)
      if (updated) setSelected(updated)
    }
  }, [aircraftTypes, selected])

  // Filter
  const filtered = useMemo(() => {
    if (!search) return aircraftTypes
    const q = search.toLowerCase()
    return aircraftTypes.filter(a =>
      a.icao_type.toLowerCase().includes(q) ||
      (a.iata_type_code || '').toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.manufacturer || '').toLowerCase().includes(q)
    )
  }, [aircraftTypes, search])

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, AircraftType[]> = {}
    for (const cat of CATEGORIES) groups[cat] = []
    for (const a of filtered) {
      const cat = a.category || 'narrow_body'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(a)
    }
    return groups
  }, [filtered])

  const toggleGroup = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  // Get configs for selected type
  const selectedConfigs = useMemo(() => {
    if (!selected) return []
    return configs.filter(c => c.aircraft_type_id === selected.id)
  }, [selected, configs])

  // ─── List Header ───────────────────────────────────────────────────────

  const renderListHeader = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Aircraft Types</h2>
          <Badge variant="secondary" className="text-[10px]">{aircraftTypes.length}</Badge>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search types..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-xs pl-9"
        />
      </div>
    </div>
  )

  // ─── List Body ─────────────────────────────────────────────────────────

  const renderListBody = (renderItem: (item: AircraftType) => React.ReactNode) => (
    <>
      {CATEGORIES.map(cat => {
        const items = grouped[cat]
        if (!items || items.length === 0) return null
        const isCollapsed = collapsed[cat]
        return (
          <div key={cat}>
            <button
              onClick={() => toggleGroup(cat)}
              className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform duration-200', !isCollapsed && 'rotate-90')} />
              <span>{CATEGORY_LABELS[cat]}</span>
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

  // ─── List Item ─────────────────────────────────────────────────────────

  const renderListItem = (ac: AircraftType, isSelected: boolean) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn('font-mono text-[11px] font-bold shrink-0', isSelected ? 'text-primary' : 'text-muted-foreground')}>
        {ac.icao_type}
      </span>
      <span className="text-sm font-medium truncate">{ac.name}</span>
    </div>
  )

  const renderCompactListItem = (ac: AircraftType) => (
    <div className="text-center">
      <div className="font-mono text-[10px] font-bold">{ac.icao_type}</div>
    </div>
  )

  // ─── Detail ────────────────────────────────────────────────────────────

  const renderDetail = (ac: AircraftType) => (
    <DetailPanel
      ac={ac}
      configs={selectedConfigs}
      onFieldUpdated={refresh}
      onConfigsChanged={(newConfigs) => {
        setConfigs(prev => {
          const others = prev.filter(c => c.aircraft_type_id !== ac.id)
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
      <MasterDetailLayout<AircraftType>
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
        <AddAircraftDialog
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
          onCreated={refresh}
        />
      )}
    </>
  )
}

// ─── Detail Panel ────────────────────────────────────────────────────────

function DetailPanel({
  ac, configs, onFieldUpdated, onConfigsChanged, activeTab, onTabChange, onDeleted,
}: {
  ac: AircraftType
  configs: AircraftTypeSeatingConfig[]
  onFieldUpdated: () => void
  onConfigsChanged: (configs: AircraftTypeSeatingConfig[]) => void
  activeTab: string
  onTabChange: (tab: string) => void
  onDeleted: () => void
}) {
  const [deleteState, setDeleteState] = useState<'idle' | 'checking' | 'confirm' | 'blocked'>('idle')
  const [regCount, setRegCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const handleDeleteClick = async () => {
    setDeleteState('checking')
    const count = await getAircraftRegistrationCount(ac.id)
    setRegCount(count)
    setDeleteState(count > 0 ? 'blocked' : 'confirm')
  }

  const handleConfirmDelete = async () => {
    setDeleting(true)
    const result = await deleteAircraftType(ac.id)
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
      {/* Hero Image Section */}
      <div className="shrink-0 mb-3 relative rounded-2xl overflow-hidden" style={{ height: '35%', minHeight: '160px' }}>
        {ac.image_url ? (
          <img src={ac.image_url} alt={ac.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-muted/30 flex flex-col items-center justify-center gap-2">
            <Plane className="h-12 w-12 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground/50">No image available</span>
          </div>
        )}
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        {/* Delete button — top right */}
        <button
          onClick={handleDeleteClick}
          disabled={deleteState === 'checking'}
          className="absolute top-3 right-3 p-2 rounded-xl bg-black/30 hover:bg-destructive/80 backdrop-blur-sm text-white/70 hover:text-white transition-all duration-200"
          title="Delete aircraft type"
        >
          <Trash2 className="h-4 w-4" />
        </button>
        {/* Info over gradient */}
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <div className="text-white font-bold text-lg leading-tight">
              {ac.icao_type} <span className="font-normal text-white/80">—</span> {ac.name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {ac.manufacturer && (
              <span className="text-white/80 text-xs font-medium">{ac.manufacturer}</span>
            )}
            <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">
              {CATEGORY_LABELS[ac.category] || ac.category}
            </Badge>
          </div>
        </div>
      </div>

      {/* Delete blocked modal */}
      <Dialog open={deleteState === 'blocked'} onOpenChange={() => setDeleteState('idle')}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Cannot Delete {ac.icao_type} — {ac.name}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This aircraft type has <span className="font-semibold text-foreground">{regCount}</span> registered aircraft. Remove all registrations first.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteState('idle')}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm modal */}
      <Dialog open={deleteState === 'confirm'} onOpenChange={() => setDeleteState('idle')}>
        <DialogContent className="glass-heavy max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {ac.icao_type} — {ac.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. All related configurations will be removed.
          </p>
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
            <TabsTrigger value="performance" className="text-xs gap-1"><Gauge className="h-3 w-3" /> Performance</TabsTrigger>
            <TabsTrigger value="tat" className="text-xs gap-1"><Clock className="h-3 w-3" /> Turn Around Time</TabsTrigger>
            <TabsTrigger value="seating" className="text-xs gap-1"><Armchair className="h-3 w-3" /> Seating</TabsTrigger>
            <TabsTrigger value="cargo" className="text-xs gap-1"><Package className="h-3 w-3" /> Cargo</TabsTrigger>
            <TabsTrigger value="crew" className="text-xs gap-1"><Users className="h-3 w-3" /> Crew & Rest Facilities</TabsTrigger>
            <TabsTrigger value="weather" className="text-xs gap-1"><CloudRain className="h-3 w-3" /> Weather</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <BasicTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="performance" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <PerformanceTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="tat" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <TATTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="seating" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <SeatingTab ac={ac} configs={configs} onConfigsChanged={onConfigsChanged} />
          </TabsContent>
          <TabsContent value="cargo" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <CargoTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="crew" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <CrewRestTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="weather" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <WeatherTab ac={ac} onSaved={onFieldUpdated} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Inline Edit Helpers ─────────────────────────────────────────────────

function InlineField({
  label, field, value, acId, onSaved, mono, type = 'text', suffix, tatMode, compact, validate,
}: {
  label?: string; field: string; value: string; acId: string; onSaved: () => void; mono?: boolean; type?: string; suffix?: string; tatMode?: boolean; compact?: boolean; validate?: (val: number | null) => string | null
}) {
  const displayValue = tatMode ? minutesToHHMM(Number(value)) || '' : value
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(displayValue)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(tatMode ? minutesToHHMM(Number(value)) || '' : value) }, [value, tatMode])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = useCallback(async () => {
    setValidationError(null)
    let finalValue: string | number | null
    if (tatMode) {
      const mins = hhmmToMinutes(editValue)
      if (mins === null && editValue.trim()) { setEditValue(displayValue); setEditing(false); return }
      finalValue = mins
      if (validate) {
        const err = validate(mins)
        if (err) { setValidationError(err); return }
      }
    } else if (type === 'number') {
      finalValue = editValue ? parseFloat(editValue) : null
    } else {
      finalValue = editValue
    }

    const compareValue = tatMode ? String(finalValue ?? '') : editValue
    const compareOriginal = tatMode ? value : value
    if (compareValue === compareOriginal) { setEditing(false); return }

    setSaving(true)
    const result = await updateAircraftTypeField(acId, field, finalValue as string | number | boolean | null)
    setSaving(false)
    if (result?.error) {
      alert(result.error)
      setEditValue(displayValue)
    } else {
      onSaved()
    }
    setEditing(false)
  }, [acId, field, editValue, value, displayValue, onSaved, type, tatMode, validate])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditValue(displayValue); setEditing(false); setValidationError(null) }
  }

  // Auto-format on blur for TAT: raw number → HH:MM
  const handleBlur = () => {
    if (tatMode && editValue && !editValue.includes(':')) {
      const mins = Number(editValue)
      if (!isNaN(mins)) setEditValue(minutesToHHMM(mins))
    }
    save()
  }

  if (compact) {
    return (
      <div>
        {editing ? (
          <Input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            type="text"
            placeholder="H:MM"
            className="font-mono text-xs h-8 text-center"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className={cn(
              'font-mono text-xs w-full text-center px-1 py-1.5 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[32px]',
              !displayValue && 'text-muted-foreground italic'
            )}
          >
            {displayValue || '—'}
          </button>
        )}
        {validationError && <p className="text-[10px] text-destructive mt-0.5 text-center">{validationError}</p>}
      </div>
    )
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5')}>
      {label && <div className="text-xs text-muted-foreground mb-1">{label}</div>}
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={saving}
            type={tatMode ? 'text' : type}
            step={type === 'number' && !tatMode ? 'any' : undefined}
            placeholder={tatMode ? 'HH:MM' : undefined}
            className={cn('h-8 text-sm flex-1', (mono || tatMode) && 'font-mono')}
          />
          {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px] flex items-center gap-2',
            (mono || tatMode) && 'font-mono',
            !displayValue && 'text-muted-foreground italic'
          )}
        >
          <span>{displayValue || '—'}</span>
          {suffix && displayValue && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </button>
      )}
      {validationError && <p className="text-[10px] text-destructive mt-1">{validationError}</p>}
    </div>
  )
}

function InlineSelect({
  label, field, value, acId, options, onSaved,
}: {
  label: string; field: string; value: string; acId: string; options: readonly string[]; onSaved: () => void
}) {
  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    const result = await updateAircraftTypeField(acId, field, newValue)
    if (result?.error) {
      alert(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5')}>
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
  label, field, value, acId, onSaved,
}: {
  label: string; field: string; value: boolean; acId: string; onSaved: () => void
}) {
  const handleChange = async (checked: boolean) => {
    const result = await updateAircraftTypeField(acId, field, checked)
    if (result?.error) {
      alert(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5 flex items-center justify-between')}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <Switch checked={value} onCheckedChange={handleChange} />
    </div>
  )
}

function InlineCategorySelect({ value, acId, onSaved }: { value: string; acId: string; onSaved: () => void }) {
  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    const result = await updateAircraftTypeField(acId, 'category', newValue)
    if (result?.error) {
      alert(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5')}>
      <div className="text-xs text-muted-foreground mb-1">Category</div>
      <Select value={value || ''} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIES.map(cat => (
            <SelectItem key={cat} value={cat}>{CATEGORY_LABELS[cat]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ManufacturerField({ value, acId, onSaved }: { value: string; acId: string; onSaved: () => void }) {
  const isKnown = MANUFACTURERS.includes(value as typeof MANUFACTURERS[number])
  const isCustom = value && !isKnown && value !== 'Custom'
  const [showCustomInput, setShowCustomInput] = useState(!!isCustom)
  const [customValue, setCustomValue] = useState(isCustom ? value : '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const known = MANUFACTURERS.includes(value as typeof MANUFACTURERS[number])
    const custom = !!value && !known && value !== 'Custom'
    setShowCustomInput(custom)
    setCustomValue(custom ? value : '')
  }, [value])

  useEffect(() => {
    if (showCustomInput && inputRef.current) inputRef.current.focus()
  }, [showCustomInput])

  const handleSelectChange = async (newValue: string) => {
    if (newValue === 'Custom') {
      setShowCustomInput(true)
      setCustomValue('')
      return
    }
    setShowCustomInput(false)
    if (newValue === value) return
    const result = await updateAircraftTypeField(acId, 'manufacturer', newValue || null)
    if (result?.error) alert(result.error)
    else { onSaved() }
  }

  const saveCustom = async () => {
    const trimmed = customValue.trim()
    if (!trimmed) return
    if (trimmed === value) return
    const result = await updateAircraftTypeField(acId, 'manufacturer', trimmed)
    if (result?.error) alert(result.error)
    else { onSaved() }
  }

  const selectValue = showCustomInput || isCustom ? 'Custom' : (value || '')
  const logoUrl = MANUFACTURER_LOGOS[value]

  return (
    <div className={cn('py-2.5 border-b border-white/5')}>
      <div className="text-xs text-muted-foreground mb-1">Manufacturer</div>
      <div className="flex items-center gap-2">
        <div className="w-10 h-5 flex items-center justify-center shrink-0">
          {logoUrl ? (
            <img src={logoUrl} alt={value} className="h-5 w-10 object-contain" />
          ) : (
            <Plane className="h-4 w-4 text-muted-foreground/40" />
          )}
        </div>
        <Select value={selectValue} onValueChange={handleSelectChange}>
          <SelectTrigger className="h-8 text-sm flex-1">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {MANUFACTURERS.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {showCustomInput && (
        <Input
          ref={inputRef}
          value={customValue}
          onChange={e => setCustomValue(e.target.value)}
          onBlur={saveCustom}
          onKeyDown={e => { if (e.key === 'Enter') saveCustom(); if (e.key === 'Escape') { setShowCustomInput(false); setCustomValue('') } }}
          placeholder="Enter manufacturer name..."
          className="h-8 text-sm mt-2"
        />
      )}
    </div>
  )
}

// ─── TAB 1: Basic Info ──────────────────────────────────────────────────

function BasicTab({ ac, onSaved }: { ac: AircraftType; onSaved: () => void }) {
  return (
    <div className="grid grid-cols-2 gap-x-6">
      <div>
        <InlineField label="ICAO Type Code" field="icao_type" value={ac.icao_type} acId={ac.id} onSaved={onSaved} mono />
        <InlineField label="IATA Type Code" field="iata_type_code" value={ac.iata_type_code || ''} acId={ac.id} onSaved={onSaved} mono />
        <InlineField label="Description" field="name" value={ac.name} acId={ac.id} onSaved={onSaved} />
        <ManufacturerField value={ac.manufacturer || ''} acId={ac.id} onSaved={onSaved} />
        <InlineField label="Family" field="family" value={ac.family || ''} acId={ac.id} onSaved={onSaved} />
      </div>
      <div>
        <InlineCategorySelect value={ac.category} acId={ac.id} onSaved={onSaved} />
        <InlineToggle label="Active" field="is_active" value={ac.is_active} acId={ac.id} onSaved={onSaved} />
      </div>
    </div>
  )
}

// ─── TAB 2: Performance ─────────────────────────────────────────────────

function PerformanceTab({ ac, onSaved }: { ac: AircraftType; onSaved: () => void }) {
  return (
    <div className="space-y-4">
      {/* Weights */}
      <Section title="Weights">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="MTOW" field="mtow_kg" value={ac.mtow_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
          <InlineField label="MLW" field="mlw_kg" value={ac.mlw_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
          <InlineField label="MZFW" field="mzfw_kg" value={ac.mzfw_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
          <InlineField label="OEW" field="oew_kg" value={ac.oew_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
        </div>
      </Section>

      {/* Fuel */}
      <Section title="Fuel">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="Max Fuel Capacity" field="max_fuel_capacity_kg" value={ac.max_fuel_capacity_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
          <InlineField label="Fuel Burn Rate" field="fuel_burn_rate_kg_per_hour" value={ac.fuel_burn_rate_kg_per_hour?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg/hr" />
        </div>
      </Section>

      {/* Speed & Range */}
      <Section title="Speed & Range">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="Cruising Speed" field="cruising_speed_kts" value={ac.cruising_speed_kts?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kts" />
          <InlineField label="Cruising Mach" field="cruising_mach" value={ac.cruising_mach?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" />
          <InlineField label="Max Range" field="max_range_nm" value={ac.max_range_nm?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="NM" />
        </div>
      </Section>

      {/* Runway */}
      <Section title="Runway">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="Min Runway Length" field="min_runway_length_m" value={ac.min_runway_length_m?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="m" />
          <InlineField label="Min Runway Width" field="min_runway_width_m" value={ac.min_runway_width_m?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="m" />
        </div>
      </Section>

      {/* Classifications */}
      <Section title="Classifications">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineSelect label="Fire Category" field="fire_category" value={ac.fire_category?.toString() || ''} acId={ac.id} options={FIRE_CATEGORIES.map(String)} onSaved={onSaved} />
          <InlineSelect label="Wake Turbulence" field="wake_turbulence_category" value={ac.wake_turbulence_category || ''} acId={ac.id} options={WAKE_CATEGORIES} onSaved={onSaved} />
          <InlineField label="Noise Category" field="noise_category" value={ac.noise_category || ''} acId={ac.id} onSaved={onSaved} />
          <InlineField label="Emissions Class" field="emissions_class" value={ac.emissions_class || ''} acId={ac.id} onSaved={onSaved} />
        </div>
      </Section>

      {/* ETOPS */}
      <Section title="ETOPS">
        <InlineToggle label="ETOPS Capable" field="etops_capable" value={ac.etops_capable || false} acId={ac.id} onSaved={onSaved} />
        {ac.etops_capable && (
          <InlineField label="Max ETOPS Rating" field="etops_max_minutes" value={ac.etops_max_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="min" />
        )}
      </Section>

      {/* Autoland */}
      <Section title="Autoland">
        <InlineToggle label="Autoland Capable" field="autoland_capable" value={ac.autoland_capable || false} acId={ac.id} onSaved={onSaved} />
        <InlineSelect label="ILS Category Required" field="ils_category_required" value={ac.ils_category_required || ''} acId={ac.id} options={ILS_CATEGORIES} onSaved={onSaved} />
      </Section>
    </div>
  )
}

// ─── TAB 3: Turn Around Times ───────────────────────────────────────────

function TATTab({ ac, onSaved }: { ac: AircraftType; onSaved: () => void }) {
  // Validation: minimum TAT cannot exceed corresponding scheduled TAT
  const makeMinValidator = (scheduledField: 'tat_dom_dom_minutes' | 'tat_dom_int_minutes' | 'tat_int_dom_minutes' | 'tat_int_int_minutes') => {
    return (minValue: number | null) => {
      const scheduledValue = ac[scheduledField]
      if (minValue != null && scheduledValue != null && minValue > scheduledValue) {
        return 'Minimum TAT cannot exceed Scheduled TAT'
      }
      return null
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Turn Around Time">
        <p className="text-[12px] text-muted-foreground mb-3">
          Scheduled TAT is used for network planning. Minimum TAT is the operational floor — the shortest safe turnaround.
        </p>

        <div className="space-y-3">
          {/* Header row */}
          <div className="grid grid-cols-5 gap-2 items-end">
            <div />
            <div className="text-[11px] font-medium text-center text-muted-foreground">DOM → DOM</div>
            <div className="text-[11px] font-medium text-center text-muted-foreground">DOM → INT</div>
            <div className="text-[11px] font-medium text-center text-muted-foreground">INT → DOM</div>
            <div className="text-[11px] font-medium text-center text-muted-foreground">INT → INT</div>
          </div>

          {/* Scheduled row */}
          <div className="grid grid-cols-5 gap-2 items-center">
            <div className="text-[12px] font-medium">Scheduled</div>
            <InlineField field="tat_dom_dom_minutes" value={ac.tat_dom_dom_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact />
            <InlineField field="tat_dom_int_minutes" value={ac.tat_dom_int_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact />
            <InlineField field="tat_int_dom_minutes" value={ac.tat_int_dom_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact />
            <InlineField field="tat_int_int_minutes" value={ac.tat_int_int_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact />
          </div>

          {/* Minimum row */}
          <div className="grid grid-cols-5 gap-2 items-center">
            <div className="text-[12px] font-medium">Minimum</div>
            <InlineField field="tat_min_dd_minutes" value={ac.tat_min_dd_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact validate={makeMinValidator('tat_dom_dom_minutes')} />
            <InlineField field="tat_min_di_minutes" value={ac.tat_min_di_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact validate={makeMinValidator('tat_dom_int_minutes')} />
            <InlineField field="tat_min_id_minutes" value={ac.tat_min_id_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact validate={makeMinValidator('tat_int_dom_minutes')} />
            <InlineField field="tat_min_ii_minutes" value={ac.tat_min_ii_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode compact validate={makeMinValidator('tat_int_int_minutes')} />
          </div>
        </div>

        {/* Legacy flat TAT */}
        <div className="mt-4 pt-3 border-t border-white/5">
          <InlineField label="Legacy Commercial TAT" field="default_tat_minutes" value={ac.default_tat_minutes?.toString() || ''} acId={ac.id} onSaved={onSaved} tatMode />
          <p className="text-[10px] text-muted-foreground mt-1">
            Fallback value when directional TAT is not configured. Prefer using the scheduled values above.
          </p>
        </div>

        {/* Info box */}
        <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-muted/30">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-[11px] text-muted-foreground">
            <strong>Scheduled TAT</strong> is used by the Greedy and Good assignment methods for safe network planning. <strong>Minimum TAT</strong> is the operational floor — the AI Optimizer may use it to find tighter solutions. Airport-specific TAT overrides take precedence over these defaults.
          </span>
        </div>
      </Section>
    </div>
  )
}

// ─── TAB 4: Seating ─────────────────────────────────────────────────────

function SeatingTab({
  ac, configs, onConfigsChanged,
}: {
  ac: AircraftType
  configs: AircraftTypeSeatingConfig[]
  onConfigsChanged: (configs: AircraftTypeSeatingConfig[]) => void
}) {
  const [showAddConfig, setShowAddConfig] = useState(false)
  const [editingConfig, setEditingConfig] = useState<AircraftTypeSeatingConfig | null>(null)
  const router = useRouter()

  const handleDelete = async (id: string) => {
    const result = await deleteSeatingConfig(id)
    if (result?.error) alert(result.error)
    else {
      onConfigsChanged(configs.filter(c => c.id !== id))
    }
  }

  const handleConfigSaved = () => {
    setShowAddConfig(false)
    setEditingConfig(null)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Seating Configurations</h3>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setShowAddConfig(true)}>
          <Plus className="h-3 w-3" /> Add Configuration
        </Button>
      </div>

      {configs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">No seating configurations defined.</div>
      ) : (
        <div className="space-y-3">
          {configs.map(config => {
            const cabins = (config.cabin_config as unknown as CabinEntry[]) || []
            const total = cabins.reduce((s, c) => s + c.seats, 0)

            return (
              <div key={config.id} className="glass rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{config.config_name}</span>
                    {config.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                    <span className="text-xs text-muted-foreground">{total} seats</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingConfig(config)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2 text-destructive" onClick={() => handleDelete(config.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Cabin layout bar */}
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

                {/* Detail */}
                <div className="text-xs text-muted-foreground">
                  {cabins.map(c => `${c.class}: ${c.seats}`).join(' / ')}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showAddConfig || editingConfig) && (
        <SeatingConfigDialog
          open={true}
          onClose={() => { setShowAddConfig(false); setEditingConfig(null) }}
          aircraftTypeId={ac.id}
          existing={editingConfig}
          onSaved={handleConfigSaved}
        />
      )}
    </div>
  )
}

// ─── TAB 5: Cargo ───────────────────────────────────────────────────────

function CargoTab({ ac, onSaved }: { ac: AircraftType; onSaved: () => void }) {
  const uldTypes = Array.isArray(ac.uld_types_accepted) ? (ac.uld_types_accepted as string[]).join(', ') : ''
  const [uldEdit, setUldEdit] = useState(uldTypes)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const val = Array.isArray(ac.uld_types_accepted) ? (ac.uld_types_accepted as string[]).join(', ') : ''
    setUldEdit(val)
  }, [ac.uld_types_accepted])

  const saveUld = async () => {
    const arr = uldEdit.split(',').map(s => s.trim()).filter(Boolean)
    const result = await updateAircraftTypeField(ac.id, 'uld_types_accepted', arr as unknown as Record<string, unknown>)
    if (result?.error) alert(result.error)
    else {
      onSaved()
    }
    setEditing(false)
  }

  return (
    <div className="space-y-4">
      <Section title="Cargo">
        <div className="grid grid-cols-2 gap-x-6">
          <InlineField label="Max Cargo Weight" field="max_cargo_weight_kg" value={ac.max_cargo_weight_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
          <InlineField label="Cargo Positions (ULD)" field="cargo_positions" value={ac.cargo_positions?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" />
          <InlineField label="Bulk Hold Capacity" field="bulk_hold_capacity_kg" value={ac.bulk_hold_capacity_kg?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" suffix="kg" />
        </div>
        <div className={cn('py-2.5 border-b border-white/5')}>
          <div className="text-xs text-muted-foreground mb-1">ULD Types Accepted</div>
          {editing ? (
            <Input
              value={uldEdit}
              onChange={e => setUldEdit(e.target.value)}
              onBlur={saveUld}
              onKeyDown={e => { if (e.key === 'Enter') saveUld(); if (e.key === 'Escape') setEditing(false) }}
              placeholder="LD3, LD6, AKE..."
              className="h-8 text-sm"
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className={cn('text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px]', !uldEdit && 'text-muted-foreground italic')}
            >
              {uldEdit || '—'}
            </button>
          )}
        </div>
      </Section>

      <Section title="Notes">
        <InlineTextarea field="notes" value={ac.notes || ''} acId={ac.id} onSaved={onSaved} />
      </Section>
    </div>
  )
}

// ─── TAB 6: Crew & Rest ─────────────────────────────────────────────────

function CrewRestTab({ ac, onSaved }: { ac: AircraftType; onSaved: () => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Section title="Cockpit Rest Facility">
          <InlineSelect label="Facility Class" field="cockpit_rest_facility_class" value={ac.cockpit_rest_facility_class || ''} acId={ac.id} options={REST_FACILITY_CLASSES} onSaved={onSaved} />
          <InlineField label="No. of Occupancy" field="cockpit_rest_positions" value={ac.cockpit_rest_positions?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" />
        </Section>

        <Section title="Cabin Rest Facility">
          <InlineSelect label="Facility Class" field="cabin_rest_facility_class" value={ac.cabin_rest_facility_class || ''} acId={ac.id} options={REST_FACILITY_CLASSES} onSaved={onSaved} />
          <InlineField label="No. of Occupancy" field="cabin_rest_positions" value={ac.cabin_rest_positions?.toString() || ''} acId={ac.id} onSaved={onSaved} type="number" />
        </Section>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
        <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
        <span className="text-[11px] text-muted-foreground">
          Crew complement rules (minimum crew per aircraft type) are managed in{' '}
          <Link href="/admin/master-database/crew-complement-rules" className="text-primary underline underline-offset-2">
            Crew Complement Rules
          </Link>
        </span>
      </div>
    </div>
  )
}

// ─── TAB 7: Weather ─────────────────────────────────────────────────────

function WeatherTab({ ac, onSaved }: { ac: AircraftType; onSaved: () => void }) {
  const wl = (ac.weather_limitations || {}) as Record<string, number | undefined>

  const saveWeatherField = async (key: string, value: string) => {
    const current = (ac.weather_limitations || {}) as Record<string, number | undefined>
    const updated = { ...current, [key]: value ? parseFloat(value) : undefined }
    const result = await updateAircraftTypeField(ac.id, 'weather_limitations', updated as unknown as Record<string, unknown>)
    if (result?.error) alert(result.error)
    else onSaved()
  }

  return (
    <div className="space-y-4">
      <Section title="Weather Limitations">
        <WeatherField label="Min Ceiling" field="min_ceiling_ft" value={wl.min_ceiling_ft} suffix="ft" onSave={saveWeatherField} />
        <WeatherField label="Min RVR" field="min_rvr_m" value={wl.min_rvr_m} suffix="m" onSave={saveWeatherField} />
        <WeatherField label="Min Visibility" field="min_visibility_m" value={wl.min_visibility_m} suffix="m" onSave={saveWeatherField} />
        <WeatherField label="Max Crosswind" field="max_crosswind_kt" value={wl.max_crosswind_kt} suffix="kt" onSave={saveWeatherField} />
        <WeatherField label="Max Wind" field="max_wind_kt" value={wl.max_wind_kt} suffix="kt" onSave={saveWeatherField} />
      </Section>

      <Section title="Approach">
        <InlineSelect label="ILS Category Required" field="ils_category_required" value={ac.ils_category_required || ''} acId={ac.id} options={ILS_CATEGORIES} onSaved={onSaved} />
        <InlineToggle label="Low Visibility Ops Capable" field="autoland_capable" value={ac.autoland_capable || false} acId={ac.id} onSaved={onSaved} />
      </Section>
    </div>
  )
}

// ─── Shared Sub-components ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function WeatherField({
  label, field, value, suffix, onSave,
}: {
  label: string; field: string; value: number | undefined; suffix: string; onSave: (field: string, value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value?.toString() || '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = () => {
    onSave(field, editValue)
    setEditing(false)
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
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            type="number"
            className="h-8 text-sm flex-1"
          />
          <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className={cn(
            'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px] flex items-center gap-2',
            !value && 'text-muted-foreground italic'
          )}
        >
          <span>{value?.toString() || '—'}</span>
          {value !== undefined && <span className="text-xs text-muted-foreground">{suffix}</span>}
        </button>
      )}
    </div>
  )
}

function InlineTextarea({
  field, value, acId, onSaved,
}: {
  field: string; value: string; acId: string; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  const save = async () => {
    if (editValue === value) { setEditing(false); return }
    const result = await updateAircraftTypeField(acId, field, editValue || null)
    if (result?.error) alert(result.error)
    else onSaved()
    setEditing(false)
  }

  return editing ? (
    <Textarea
      ref={ref}
      value={editValue}
      onChange={e => setEditValue(e.target.value)}
      onBlur={save}
      rows={3}
      className="text-sm"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        'text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[60px]',
        !value && 'text-muted-foreground italic'
      )}
    >
      {value || 'Click to add notes...'}
    </button>
  )
}

// ─── Seating Config Dialog ──────────────────────────────────────────────

function SeatingConfigDialog({
  open, onClose, aircraftTypeId, existing, onSaved,
}: {
  open: boolean
  onClose: () => void
  aircraftTypeId: string
  existing: AircraftTypeSeatingConfig | null
  onSaved: () => void
}) {
  const [name, setName] = useState(existing?.config_name || '')
  const [isDefault, setIsDefault] = useState(existing?.is_default || false)
  const [cabins, setCabins] = useState<CabinEntry[]>(
    existing ? (existing.cabin_config as unknown as CabinEntry[]) : [{ class: 'Y', seats: 0 }]
  )
  const [saving, setSaving] = useState(false)

  const addCabin = () => setCabins(prev => [...prev, { class: 'Y', seats: 0 }])
  const removeCabin = (idx: number) => setCabins(prev => prev.filter((_, i) => i !== idx))
  const updateCabin = (idx: number, field: keyof CabinEntry, val: string | number) => {
    setCabins(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c))
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const validCabins = cabins.filter(c => c.seats > 0)

    let result
    if (existing) {
      result = await updateSeatingConfig(existing.id, name, validCabins, isDefault, aircraftTypeId)
    } else {
      result = await createSeatingConfig(aircraftTypeId, name, validCabins, isDefault)
    }

    setSaving(false)
    if (result?.error) alert(result.error)
    else {
      onSaved()
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-heavy max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit' : 'Add'} Seating Configuration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs text-muted-foreground">Configuration Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} className="h-8 text-sm mt-1" placeholder="e.g. Standard, Two-class" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">Cabin Classes</label>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={addCabin}>
                <Plus className="h-3 w-3" /> Add Cabin
              </Button>
            </div>
            {cabins.map((cab, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select value={cab.class} onValueChange={v => updateCabin(idx, 'class', v)}>
                  <SelectTrigger className="h-8 text-sm w-20">
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
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Set as Default</label>
            <Switch checked={isDefault} onCheckedChange={setIsDefault} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : existing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Aircraft Type Dialog ───────────────────────────────────────────

function AddAircraftDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const result = await createAircraftType(formData)
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
          <DialogTitle>Add Aircraft Type</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">ICAO Code *</label>
              <Input name="icao_type" required className="h-8 text-sm mt-1 font-mono" placeholder="A320" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">IATA Code</label>
              <Input name="iata_type_code" className="h-8 text-sm mt-1 font-mono" placeholder="320" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Description *</label>
            <Input name="name" required className="h-8 text-sm mt-1" placeholder="Airbus A320-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Manufacturer</label>
              <select name="manufacturer" className="h-8 text-sm mt-1 w-full rounded-md border border-input bg-background px-3">
                <option value="">Select...</option>
                {MANUFACTURERS.filter(m => m !== 'Custom').map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <select name="category" className="h-8 text-sm mt-1 w-full rounded-md border border-input bg-background px-3">
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Family</label>
            <Input name="family" className="h-8 text-sm mt-1" placeholder="A320" />
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
