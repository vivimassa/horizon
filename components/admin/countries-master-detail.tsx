'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { type CountryWithZoneCount } from '@/app/actions/countries'
import { TimezoneZone } from '@/types/database'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import { CountryFormDialog } from './country-form-dialog'
import { updateCountryField } from '@/app/actions/countries'
import { getTimezoneZones, createTimezoneZone, updateTimezoneZone, deleteTimezoneZone } from '@/app/actions/timezone-zones'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Globe,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Info,
  Check,
  X,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CountryMap = dynamic(() => import('./country-map'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl glass h-full flex items-center justify-center">
      <span className="text-sm text-muted-foreground animate-pulse">Loading map...</span>
    </div>
  ),
})

type SortColumn = 'iso_code_2' | 'name' | null
type SortDirection = 'asc' | 'desc'

const REGIONS = ['Asia', 'Europe', 'Americas', 'Africa', 'Oceania', 'Middle East'] as const

// ─── Region Grouping ──────────────────────────────────────────────────────

const SUB_REGION_DISPLAY: Record<string, string> = {
  'South-Eastern Asia': 'Southeast Asia',
  'Eastern Asia': 'East Asia',
  'Southern Asia': 'South Asia',
  'Western Asia': 'West Asia',
  'Central Asia': 'Central Asia',
  'Northern Europe': 'Europe',
  'Western Europe': 'Europe',
  'Eastern Europe': 'Europe',
  'Southern Europe': 'Europe',
  'Northern America': 'North America',
  'South America': 'South America',
  'Central America': 'Central America',
  'Caribbean': 'Caribbean',
  'Northern Africa': 'Africa',
  'Western Africa': 'Africa',
  'Eastern Africa': 'Africa',
  'Southern Africa': 'Africa',
  'Middle Africa': 'Africa',
  'Oceania': 'Oceania',
}

const REGION_ORDER = [
  'Southeast Asia',
  'East Asia',
  'South Asia',
  'West Asia',
  'Central Asia',
  'Europe',
  'North America',
  'South America',
  'Central America',
  'Caribbean',
  'Africa',
  'Oceania',
  'Middle East',
  'Other',
]

function getRegionGroup(country: CountryWithZoneCount): string {
  if (country.sub_region) {
    return SUB_REGION_DISPLAY[country.sub_region] || country.sub_region
  }
  return country.region || 'Other'
}

// ─── Main Component ───────────────────────────────────────────────────────

export function CountriesMasterDetail({ countries }: { countries: CountryWithZoneCount[] }) {
  const [selectedCountry, setSelectedCountry] = useState<CountryWithZoneCount | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editCountry, setEditCountry] = useState<CountryWithZoneCount | null>(null)
  const [activeTab, setActiveTab] = useState('basic')
  const router = useRouter()

  // Collapsed state: all regions collapsed except operator's region (Vietnam → Southeast Asia)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const allGroups = new Set<string>()
    for (const c of countries) {
      allGroups.add(getRegionGroup(c))
    }
    allGroups.delete('Southeast Asia')
    return allGroups
  })

  function toggleGroup(name: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Flat filtered + sorted list (for search mode)
  const filteredAndSorted = useMemo(() => {
    let filtered = countries
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((c) =>
        c.iso_code_2.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query)
      )
    }
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn] || ''
        const bVal = b[sortColumn] || ''
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return filtered
  }, [countries, searchQuery, sortColumn, sortDirection])

  // Grouped by region (for non-search mode)
  const regionGroups = useMemo(() => {
    const groups = new Map<string, CountryWithZoneCount[]>()
    for (const country of countries) {
      const group = getRegionGroup(country)
      if (!groups.has(group)) groups.set(group, [])
      groups.get(group)!.push(country)
    }
    // Sort within each group
    if (sortColumn) {
      groups.forEach((items) => {
        items.sort((a, b) => {
          const aVal = a[sortColumn] || ''
          const bVal = b[sortColumn] || ''
          if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
          if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
          return 0
        })
      })
    }
    // Order groups by predefined order
    return Array.from(groups.entries()).sort(([a], [b]) => {
      const ai = REGION_ORDER.indexOf(a)
      const bi = REGION_ORDER.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  }, [countries, sortColumn, sortDirection])

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function getSortIcon(column: SortColumn) {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3" />
    return sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  return (
    <>
      <MasterDetailLayout<CountryWithZoneCount>
        items={filteredAndSorted}
        selectedItem={selectedCountry}
        onSelectItem={setSelectedCountry}
        keyExtractor={(c) => c.id}
        className="h-full"
        renderListHeader={() => (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Countries</h2>
              <Button size="sm" onClick={() => { setEditCountry(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{filteredAndSorted.length} of {countries.length}</span>
              <span className="mx-1">|</span>
              <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                Name {getSortIcon('name')}
              </button>
              <button onClick={() => handleSort('iso_code_2')} className="flex items-center gap-1 hover:text-foreground transition-colors ml-2">
                Code {getSortIcon('iso_code_2')}
              </button>
            </div>
          </div>
        )}
        renderListBody={(renderItem) => {
          // When searching, show flat filtered results
          if (searchQuery) {
            return <>{filteredAndSorted.map(renderItem)}</>
          }
          // Grouped by region
          return (
            <>
              {regionGroups.map(([groupName, groupCountries]) => (
                <div key={groupName}>
                  <button
                    onClick={() => toggleGroup(groupName)}
                    className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
                  >
                    <ChevronRight
                      className={cn(
                        'h-3 w-3 shrink-0 transition-transform duration-200',
                        !collapsedGroups.has(groupName) && 'rotate-90'
                      )}
                    />
                    <span>{groupName}</span>
                    <span className="text-muted-foreground/40">({groupCountries.length})</span>
                    <div className="flex-1 h-px bg-border/50 ml-1" />
                  </button>
                  <div className={cn('region-collapse', !collapsedGroups.has(groupName) && 'expanded')}>
                    <div className="space-y-0.5">
                      {groupCountries.map(renderItem)}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )
        }}
        renderListItem={(country, isSelected) => (
          <div className="flex items-center gap-3">
            <span className={cn(
              'font-mono text-[11px] font-semibold w-7 shrink-0 text-muted-foreground',
              isSelected && 'text-primary'
            )}>
              {country.iso_code_2}
            </span>
            <span className="text-sm font-medium truncate">{country.name}</span>
          </div>
        )}
        renderCompactListItem={(country) => (
          <span className="text-[10px] font-mono font-semibold">{country.iso_code_2}</span>
        )}
        renderDetail={(country) => (
          <CountryDetail
            country={country}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onFieldUpdated={() => router.refresh()}
          />
        )}
        renderEmptyDetail={() => (
          <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
            <Globe className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a country</p>
            <p className="text-sm mt-1">Choose a country from the list to view its details</p>
          </div>
        )}
      />

      <CountryFormDialog open={formOpen} onOpenChange={setFormOpen} country={editCountry} />
    </>
  )
}

// ─── Country Detail Panel ────────────────────────────────────────────────

function CountryDetail({
  country,
  activeTab,
  onTabChange,
  onFieldUpdated,
}: {
  country: CountryWithZoneCount
  activeTab: string
  onTabChange: (tab: string) => void
  onFieldUpdated: () => void
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header — name + region only */}
      <div className="shrink-0 mb-3">
        <h2 className="text-2xl font-bold">{country.name}</h2>
        <p className="text-muted-foreground text-sm">{country.region}</p>
      </div>

      {/* Map — 45-50% height with flag pill overlay */}
      <div className="shrink-0 mb-3 relative" style={{ height: '48%', minHeight: '200px' }}>
        <CountryMap isoCode2={country.iso_code_2} className="h-full" />
        {/* Flag + Official Name pill overlay — top left */}
        <div
          className="absolute top-3 left-3 z-[1000] flex items-center gap-2.5 px-4 py-2 rounded-full"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          <img
            src={`https://flagsapi.com/${country.iso_code_2}/shiny/64.png`}
            alt={`${country.name} flag`}
            width={32}
            height={32}
            className="shrink-0 drop-shadow-md"
            loading="lazy"
          />
          <span className="text-white font-bold text-sm truncate max-w-[240px]">
            {country.official_name || country.name}
          </span>
        </div>
      </div>

      {/* Tabs + Content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
          <TabsList className="glass shrink-0 justify-start">
            <TabsTrigger value="basic">
              <span className="flex items-center gap-2"><Info className="h-4 w-4" /> Basic Info</span>
            </TabsTrigger>
            <TabsTrigger value="timezones">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Timezone Zones
                {country.zone_count > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 ml-1">{country.zone_count}</Badge>
                )}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <BasicInfoTab country={country} onFieldUpdated={onFieldUpdated} />
          </TabsContent>

          <TabsContent value="timezones" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <TimezoneZonesTab countryId={country.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ─── Basic Info Tab (inline editing) ─────────────────────────────────────

function BasicInfoTab({ country, onFieldUpdated }: { country: CountryWithZoneCount; onFieldUpdated: () => void }) {
  return (
    <div className="glass rounded-2xl p-5 space-y-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
        <InlineField label="Country Name" field="name" value={country.name} countryId={country.id} onSaved={onFieldUpdated} />
        <InlineField label="Official Name" field="official_name" value={country.official_name || ''} countryId={country.id} onSaved={onFieldUpdated} />
        <InlineField label="Currency Code" field="currency_code" value={country.currency_code || ''} countryId={country.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Currency Name" field="currency_name" value={country.currency_name || ''} countryId={country.id} onSaved={onFieldUpdated} />
        <InlineField label="Currency Symbol" field="currency_symbol" value={country.currency_symbol || ''} countryId={country.id} onSaved={onFieldUpdated} />
        <InlineField label="ICAO Prefix" field="icao_prefix" value={country.icao_prefix || ''} countryId={country.id} onSaved={onFieldUpdated} mono />
      </div>
    </div>
  )
}

// ─── Inline editable field ───────────────────────────────────────────────

function InlineField({
  label, field, value, countryId, onSaved, mono,
}: {
  label: string; field: string; value: string; countryId: string; onSaved: () => void; mono?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const save = useCallback(async () => {
    if (editValue === value) { setEditing(false); return }
    setSaving(true)
    const result = await updateCountryField(countryId, field, editValue)
    setSaving(false)
    if (result?.error) {
      alert(result.error)
      setEditValue(value)
    } else {
      onSaved()
    }
    setEditing(false)
  }, [countryId, field, editValue, value, onSaved])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditValue(value); setEditing(false) }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5')}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
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

function InlineSelectField({
  label, field, value, countryId, options, onSaved,
}: {
  label: string; field: string; value: string; countryId: string; options: readonly string[]; onSaved: () => void
}) {
  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    const result = await updateCountryField(countryId, field, newValue)
    if (result?.error) {
      alert(result.error)
    } else {
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5')}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Select region..." />
        </SelectTrigger>
        <SelectContent className="glass-heavy">
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ─── Timezone Zones Tab ──────────────────────────────────────────────────

function TimezoneZonesTab({ countryId }: { countryId: string }) {
  const [zones, setZones] = useState<TimezoneZone[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editingZone, setEditingZone] = useState<TimezoneZone | null>(null)
  const [deleteZone, setDeleteZone] = useState<TimezoneZone | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchZones = useCallback(async () => {
    setLoading(true)
    const data = await getTimezoneZones(countryId)
    setZones(data)
    setLoading(false)
  }, [countryId])

  useEffect(() => { fetchZones() }, [fetchZones])

  async function handleDelete() {
    if (!deleteZone) return
    setDeleting(true)
    const result = await deleteTimezoneZone(deleteZone.id)
    if (result?.error) alert(result.error)
    else fetchZones()
    setDeleting(false)
    setDeleteZone(null)
  }

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Timezone Zones</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Timezone data sourced from IANA database. DST transitions are handled automatically.
          </p>
        </div>
        <Button size="sm" onClick={() => { setEditingZone(null); setAddOpen(true) }}>
          <Plus className="h-4 w-4 mr-1" /> Add Zone
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading zones...</div>
      ) : zones.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No timezone zones configured. Click &quot;Add Zone&quot; to create one.
        </div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Zone</th>
                <th className="text-left py-2 px-2 font-medium">Name</th>
                <th className="text-left py-2 px-2 font-medium">IANA Timezone</th>
                <th className="text-left py-2 px-2 font-medium">UTC Offset</th>
                <th className="text-left py-2 px-2 font-medium">DST</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b border-white/5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-2 font-mono text-xs font-semibold">{zone.zone_code}</td>
                  <td className="py-2.5 px-2">{zone.zone_name}</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{zone.iana_timezone}</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{zone.utc_offset}</td>
                  <td className="py-2.5 px-2">
                    {zone.dst_observed ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditingZone(zone); setAddOpen(true) }}>
                        <Info className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteZone(zone)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Zone Dialog */}
      <ZoneFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        countryId={countryId}
        zone={editingZone}
        nextZoneCode={zones.length > 0 ? String(Math.max(...zones.map((z) => parseInt(z.zone_code) || 0)) + 1) : '1'}
        onSaved={fetchZones}
      />

      {/* Delete confirmation */}
      <Dialog open={!!deleteZone} onOpenChange={(open) => { if (!open) setDeleteZone(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Timezone Zone</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete zone &quot;{deleteZone?.zone_name}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteZone(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Zone Form Dialog ────────────────────────────────────────────────────

function ZoneFormDialog({
  open,
  onOpenChange,
  countryId,
  zone,
  nextZoneCode,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  countryId: string
  zone: TimezoneZone | null
  nextZoneCode: string
  onSaved: () => void
}) {
  const isEdit = !!zone
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dstObserved, setDstObserved] = useState(zone?.dst_observed ?? false)

  useEffect(() => {
    setDstObserved(zone?.dst_observed ?? false)
    setError(null)
  }, [zone, open])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.currentTarget)
    const data = {
      country_id: countryId,
      zone_code: form.get('zone_code') as string,
      zone_name: form.get('zone_name') as string,
      iana_timezone: form.get('iana_timezone') as string,
      utc_offset: form.get('utc_offset') as string,
      dst_observed: dstObserved,
      notes: (form.get('notes') as string) || null,
    }

    const result = isEdit
      ? await updateTimezoneZone(zone.id, data)
      : await createTimezoneZone(data)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      onOpenChange(false)
      onSaved()
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Zone' : 'Add Timezone Zone'}</DialogTitle>
          <DialogDescription>{isEdit ? 'Update timezone zone details.' : 'Add a new timezone zone.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">Zone Code</label>
              <Input name="zone_code" defaultValue={zone?.zone_code ?? nextZoneCode} required className="font-mono" disabled={loading} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Zone Name</label>
              <Input name="zone_name" defaultValue={zone?.zone_name || ''} placeholder="New York (Eastern)" required disabled={loading} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium">IANA Timezone</label>
              <Input name="iana_timezone" defaultValue={zone?.iana_timezone || ''} placeholder="America/New_York" required className="font-mono" disabled={loading} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">UTC Offset</label>
              <Input name="utc_offset" defaultValue={zone?.utc_offset || ''} placeholder="-05:00" required className="font-mono" disabled={loading} />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 border-y border-white/10">
            <label className="text-sm font-medium">DST Observed</label>
            <Switch checked={dstObserved} onCheckedChange={setDstObserved} disabled={loading} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Notes</label>
            <Input name="notes" defaultValue={zone?.notes || ''} placeholder="Optional notes..." disabled={loading} />
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Zone' : 'Add Zone'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
