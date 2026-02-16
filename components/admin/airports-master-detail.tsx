'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { type AirportWithCountry, updateAirportField, updateAirportFields } from '@/app/actions/airports'
import { getRunways, createRunway, updateRunway, deleteRunway } from '@/app/actions/airport-subtables'
import { getTerminals, createTerminal, updateTerminal, deleteTerminal } from '@/app/actions/airport-subtables'
import { getCurfews, createCurfew, updateCurfew, deleteCurfew } from '@/app/actions/airport-subtables'
import { getFrequencies, createFrequency, updateFrequency, deleteFrequency } from '@/app/actions/airport-subtables'
import { getWeatherLimits, upsertWeatherLimit } from '@/app/actions/airport-subtables'
import { getTatRulesForAirport, createTatRule, updateTatRule, deleteTatRule, type TatRuleWithType } from '@/app/actions/airport-tat-rules'
import { inquireAirport, applyInquiryData, importNewAirport, type InquiryResult, type InquiryRunway, type InquiryFrequency } from '@/app/actions/airport-inquiry'
import { createAirport } from '@/app/actions/airports'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Trash2, Search, Plane, ChevronRight, Info, Clock, Radio, Cloud, Timer, Users, AlertTriangle, Satellite, CheckCircle2, Loader2,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { cn, minutesToHHMM, hhmmToMinutes } from '@/lib/utils'
import type { Country, TimezoneZone, AircraftType, AirportRunway, AirportTerminal, AirportCurfew, AirportFrequency, AirportWeatherLimit } from '@/types/database'

const AirportMap = dynamic(() => import('./airport-map'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl glass h-full flex items-center justify-center">
      <span className="text-sm text-muted-foreground animate-pulse">Loading map...</span>
    </div>
  ),
})

// ─── Types ───────────────────────────────────────────────────────────────

interface Props {
  airports: AirportWithCountry[]
  countries: Country[]
  timezoneZones: TimezoneZone[]
  aircraftTypes: AircraftType[]
}

// ─── Main Component ──────────────────────────────────────────────────────

export function AirportsMasterDetail({ airports, countries, timezoneZones, aircraftTypes }: Props) {
  const [selectedAirport, setSelectedAirport] = useState<AirportWithCountry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('basic')
  const [addAirportOpen, setAddAirportOpen] = useState(false)
  const router = useRouter()

  // Group airports by country
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    const allGroups = new Set<string>()
    for (const a of airports) {
      allGroups.add(a.countries?.name || 'Unknown')
    }
    // Expand Vietnam by default
    allGroups.delete('Vietnam')
    allGroups.delete('Viet Nam')
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

  const filteredAirports = useMemo(() => {
    if (!searchQuery) return airports
    const q = searchQuery.toLowerCase()
    return airports.filter((a) =>
      (a.iata_code?.toLowerCase().includes(q)) ||
      (a.icao_code?.toLowerCase().includes(q)) ||
      a.name.toLowerCase().includes(q) ||
      (a.city?.toLowerCase().includes(q))
    )
  }, [airports, searchQuery])

  const countryGroups = useMemo(() => {
    const groups = new Map<string, AirportWithCountry[]>()
    const list = searchQuery ? filteredAirports : airports
    for (const apt of list) {
      const country = apt.countries?.name || 'Unknown'
      if (!groups.has(country)) groups.set(country, [])
      groups.get(country)!.push(apt)
    }
    // Sort within groups by IATA code
    groups.forEach((items) => {
      items.sort((a, b) => (a.iata_code || a.icao_code).localeCompare(b.iata_code || b.icao_code))
    })
    // Sort groups: Vietnam first, then alphabetical
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Vietnam' || a === 'Viet Nam') return -1
      if (b === 'Vietnam' || b === 'Viet Nam') return 1
      return a.localeCompare(b)
    })
  }, [airports, filteredAirports, searchQuery])

  return (
    <MasterDetailLayout<AirportWithCountry>
      items={filteredAirports}
      selectedItem={selectedAirport}
      onSelectItem={setSelectedAirport}
      keyExtractor={(a) => a.id}
      className="h-full"
      renderListHeader={() => (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Airports</h2>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-xs">{airports.length}</Badge>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setAddAirportOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search IATA, ICAO, name, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <AddAirportModal
            open={addAirportOpen}
            onOpenChange={setAddAirportOpen}
            existingAirports={airports}
            onImported={() => router.refresh()}
          />
        </div>
      )}
      renderListBody={(renderItem) => (
        <>
          {countryGroups.map(([groupName, groupAirports]) => (
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
                <span className="text-muted-foreground/40">({groupAirports.length})</span>
                <div className="flex-1 h-px bg-border/50 ml-1" />
              </button>
              <div className={cn('region-collapse', !collapsedGroups.has(groupName) && 'expanded')}>
                <div className="space-y-0.5">
                  {groupAirports.map(renderItem)}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      renderListItem={(airport, isSelected) => (
        <div className="flex items-center gap-3 min-w-0">
          <span className={cn(
            'font-mono text-[11px] font-bold w-8 shrink-0',
            isSelected ? 'text-primary' : 'text-muted-foreground'
          )}>
            {airport.iata_code || '—'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{airport.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">{airport.city}</div>
          </div>
        </div>
      )}
      renderCompactListItem={(airport) => (
        <span className="text-[10px] font-mono font-bold">{airport.iata_code || airport.icao_code?.slice(0, 3)}</span>
      )}
      renderDetail={(airport) => (
        <AirportDetail
          airport={airport}
          countries={countries}
          timezoneZones={timezoneZones}
          aircraftTypes={aircraftTypes}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onFieldUpdated={() => router.refresh()}
        />
      )}
      renderEmptyDetail={() => (
        <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground">
          <Plane className="h-12 w-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">Select an airport</p>
          <p className="text-sm mt-1">Choose an airport from the list to view its details</p>
        </div>
      )}
    />
  )
}

// ─── Dual Clock Widget ──────────────────────────────────────────────────

function DualClock({ ianaTimezone }: { ianaTimezone: string | null }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const utcStr = now.toLocaleTimeString('en-GB', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const localStr = ianaTimezone
    ? now.toLocaleTimeString('en-GB', { timeZone: ianaTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '—'

  return (
    <div className="flex items-center gap-3 text-xs shrink-0">
      <div className="text-right">
        <div className="text-muted-foreground text-[10px]">UTC</div>
        <div className="font-mono font-semibold">{utcStr}</div>
      </div>
      <div className="w-px h-6 bg-border" />
      <div className="text-right">
        <div className="text-muted-foreground text-[10px]">Local</div>
        <div className="font-mono font-semibold">{localStr}</div>
      </div>
    </div>
  )
}

// ─── Airport Detail Panel ───────────────────────────────────────────────

function AirportDetail({
  airport,
  countries,
  timezoneZones,
  aircraftTypes,
  activeTab,
  onTabChange,
  onFieldUpdated,
}: {
  airport: AirportWithCountry
  countries: Country[]
  timezoneZones: TimezoneZone[]
  aircraftTypes: AircraftType[]
  activeTab: string
  onTabChange: (tab: string) => void
  onFieldUpdated: () => void
}) {
  const iana = airport.timezone_zones?.iana_timezone || airport.timezone || null
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [inquiryLoading, setInquiryLoading] = useState(false)
  const [inquiryData, setInquiryData] = useState<InquiryResult | null>(null)
  const [existingRunways, setExistingRunways] = useState<AirportRunway[]>([])
  const [existingFreqs, setExistingFreqs] = useState<AirportFrequency[]>([])
  const [runwayCount, setRunwayCount] = useState<number | null>(null)
  const [freqCount, setFreqCount] = useState<number | null>(null)

  // Check completeness for inquiry button status
  const refreshCounts = useCallback(async () => {
    const [rwys, freqs] = await Promise.all([
      getRunways(airport.id),
      getFrequencies(airport.id),
    ])
    setRunwayCount(rwys.length)
    setFreqCount(freqs.length)
    setExistingRunways(rwys)
    setExistingFreqs(freqs)
  }, [airport.id])

  useEffect(() => {
    let cancelled = false
    refreshCounts().then(() => { if (cancelled) return })
    return () => { cancelled = true }
  }, [refreshCounts])

  const isComplete = airport.latitude != null && airport.longitude != null
    && airport.elevation_ft != null && (runwayCount ?? 0) > 0 && (freqCount ?? 0) > 0

  const missingFields: string[] = []
  if (airport.latitude == null || airport.longitude == null) missingFields.push('lat/lon')
  if (airport.elevation_ft == null) missingFields.push('elevation')
  if (runwayCount !== null && runwayCount === 0) missingFields.push('runways')
  if (freqCount !== null && freqCount === 0) missingFields.push('frequencies')

  const handleInquiry = async () => {
    setInquiryLoading(true)
    const data = await inquireAirport(airport.icao_code)
    setInquiryData(data)
    setInquiryLoading(false)
    if (data.found) {
      setInquiryOpen(true)
    } else {
      // Show error in modal anyway so user sees the message
      setInquiryOpen(true)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold truncate">{airport.name}</h2>
            {isComplete ? (
              <Badge variant="secondary" className="text-[10px] gap-1 shrink-0 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                <CheckCircle2 className="h-3 w-3" /> Complete
              </Badge>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs h-7 gap-1.5"
                      onClick={handleInquiry}
                      disabled={inquiryLoading}
                    >
                      {inquiryLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Satellite className="h-3.5 w-3.5" />
                      )}
                      {inquiryLoading ? 'Fetching...' : 'Inquiry'}
                    </Button>
                  </TooltipTrigger>
                  {missingFields.length > 0 && (
                    <TooltipContent>
                      <p>Missing: {missingFields.join(', ')}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {airport.city}{airport.countries ? `, ${airport.countries.name}` : ''}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {airport.iata_code && (
              <Badge variant="secondary" className="font-mono text-xs">{`IATA: ${airport.iata_code}`}</Badge>
            )}
            <Badge variant="secondary" className="font-mono text-xs">{`ICAO: ${airport.icao_code}`}</Badge>
          </div>
        </div>
        <DualClock ianaTimezone={iana} />
      </div>

      {/* Inquiry Modal */}
      <InquiryModal
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        airportId={airport.id}
        icaoCode={airport.icao_code}
        iataCode={airport.iata_code}
        data={inquiryData}
        currentAirport={airport}
        existingRunways={existingRunways}
        existingFreqs={existingFreqs}
        onApplied={() => {
          onFieldUpdated()
          refreshCounts()
        }}
      />

      {/* Map — ~28% height */}
      {airport.latitude && airport.longitude ? (
        <div className="shrink-0 mb-3" style={{ height: '28%', minHeight: '160px' }}>
          <AirportMap
            latitude={airport.latitude}
            longitude={airport.longitude}
            name={airport.name}
            isoCode2={airport.countries?.iso_code_2}
            flagEmoji={airport.countries?.flag_emoji}
            className="h-full"
          />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-col h-full">
          <TabsList className="glass shrink-0 justify-start flex-wrap h-auto gap-0.5 py-1">
            <TabsTrigger value="basic" className="text-xs"><span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> Basic</span></TabsTrigger>
            <TabsTrigger value="runway" className="text-xs"><span className="flex items-center gap-1.5"><Plane className="h-3.5 w-3.5" /> Runway & Facilities</span></TabsTrigger>
            <TabsTrigger value="operations" className="text-xs"><span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5" /> Operations</span></TabsTrigger>
            <TabsTrigger value="weather" className="text-xs"><span className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> Weather</span></TabsTrigger>
            <TabsTrigger value="tat" className="text-xs"><span className="flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" /> Turn Around Time</span></TabsTrigger>
            <TabsTrigger value="crew" className="text-xs"><span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> Crew</span></TabsTrigger>
            <TabsTrigger value="diversions" className="text-xs"><span className="flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Diversions</span></TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <BasicInfoTab airport={airport} countries={countries} timezoneZones={timezoneZones} onFieldUpdated={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="runway" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <RunwayFacilitiesTab airport={airport} onFieldUpdated={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="operations" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <OperationsTab airport={airport} onFieldUpdated={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="weather" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <WeatherTab airport={airport} onFieldUpdated={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="tat" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <TatTab airport={airport} aircraftTypes={aircraftTypes} />
          </TabsContent>
          <TabsContent value="crew" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <CrewTab airport={airport} onFieldUpdated={onFieldUpdated} />
          </TabsContent>
          <TabsContent value="diversions" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
            <DiversionsTab airport={airport} onFieldUpdated={onFieldUpdated} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// INLINE FIELD COMPONENTS (reusable across tabs)
// ═══════════════════════════════════════════════════════════════════════════

function InlineField({
  label, field, value, airportId, onSaved, mono, type = 'text',
}: {
  label: string; field: string; value: string; airportId: string; onSaved: () => void; mono?: boolean; type?: string
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
    const numericFields = ['latitude', 'longitude', 'elevation_ft', 'fire_category',
      'slot_departure_tolerance_early', 'slot_departure_tolerance_late',
      'slot_arrival_tolerance_early', 'slot_arrival_tolerance_late',
      'crew_reporting_time_minutes', 'crew_debrief_time_minutes',
      'crew_positioning_reporting_minutes', 'etops_diversion_minutes']
    const val = numericFields.includes(field) ? (editValue === '' ? null : Number(editValue)) : editValue
    const result = await updateAirportField(airportId, field, val as string | number | boolean | null)
    setSaving(false)
    if (result?.error) { alert(result.error); setEditValue(value) }
    else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
    setEditing(false)
  }, [airportId, field, editValue, value, onSaved])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setEditValue(value); setEditing(false) }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5', flashClass)}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {editing ? (
        <Input ref={inputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)}
          onBlur={save} onKeyDown={handleKeyDown} disabled={saving} type={type}
          className={cn('h-8 text-sm', mono && 'font-mono')} />
      ) : (
        <button onClick={() => setEditing(true)}
          className={cn('text-sm text-left w-full px-2 py-1 -mx-2 rounded-md hover:bg-white/50 dark:hover:bg-white/10 transition-colors min-h-[28px]',
            mono && 'font-mono', !value && 'text-muted-foreground italic')}>
          {value || '—'}
        </button>
      )}
    </div>
  )
}

function InlineSelectField({
  label, field, value, airportId, options, onSaved,
}: {
  label: string; field: string; value: string; airportId: string
  options: { value: string; label: string }[]; onSaved: () => void
}) {
  const [flashClass, setFlashClass] = useState('')

  const handleChange = async (newValue: string) => {
    if (newValue === value) return
    const result = await updateAirportField(airportId, field, newValue)
    if (result?.error) alert(result.error)
    else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5', flashClass)}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
        <SelectContent className="glass-heavy max-h-60">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function InlineToggle({
  label, field, value, airportId, onSaved, description,
}: {
  label: string; field: string; value: boolean; airportId: string; onSaved: () => void; description?: string
}) {
  const [flashClass, setFlashClass] = useState('')

  const handleChange = async (checked: boolean) => {
    const result = await updateAirportField(airportId, field, checked)
    if (result?.error) alert(result.error)
    else {
      setFlashClass('animate-[flash-green_0.8s_ease-out]')
      setTimeout(() => setFlashClass(''), 800)
      onSaved()
    }
  }

  return (
    <div className={cn('py-2.5 border-b border-white/5 flex items-center justify-between', flashClass)}>
      <div>
        <div className="text-sm font-medium">{label}</div>
        {description && <div className="text-[10px] text-muted-foreground">{description}</div>}
      </div>
      <Switch checked={value} onCheckedChange={handleChange} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: BASIC INFO
// ═══════════════════════════════════════════════════════════════════════════

function BasicInfoTab({
  airport, countries, timezoneZones, onFieldUpdated,
}: {
  airport: AirportWithCountry; countries: Country[]; timezoneZones: TimezoneZone[]; onFieldUpdated: () => void
}) {
  const countryOptions = countries
    .filter((c) => c.is_active)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: c.id, label: `${c.flag_emoji || ''} ${c.name}`.trim() }))

  const filteredZones = timezoneZones
    .filter((z) => z.country_id === airport.country_id)
    .map((z) => ({ value: z.id, label: `${z.zone_name} (${z.iana_timezone})` }))

  const statusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'seasonal', label: 'Seasonal' },
    { value: 'closed', label: 'Closed' },
  ]

  return (
    <div className="glass rounded-2xl p-5 space-y-1">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
        <InlineField label="IATA Code" field="iata_code" value={airport.iata_code || ''} airportId={airport.id} onSaved={onFieldUpdated} mono />
        <InlineField label="ICAO Code" field="icao_code" value={airport.icao_code} airportId={airport.id} onSaved={onFieldUpdated} mono />
        <InlineField label="Airport Name" field="name" value={airport.name} airportId={airport.id} onSaved={onFieldUpdated} />
        <InlineField label="City" field="city" value={airport.city || ''} airportId={airport.id} onSaved={onFieldUpdated} />
        <InlineSelectField label="Country" field="country_id" value={airport.country_id || ''} airportId={airport.id} options={countryOptions} onSaved={onFieldUpdated} />
        {filteredZones.length > 0 && (
          <InlineSelectField label="Timezone Zone" field="timezone_zone_id" value={airport.timezone_zone_id || ''} airportId={airport.id} options={filteredZones} onSaved={onFieldUpdated} />
        )}
        <InlineField label="Latitude" field="latitude" value={airport.latitude?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
        <InlineField label="Longitude" field="longitude" value={airport.longitude?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
        <InlineField label="Elevation (ft)" field="elevation_ft" value={airport.elevation_ft?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
        <InlineSelectField label="Status" field="is_active" value={airport.is_active ? 'active' : 'closed'} airportId={airport.id} options={statusOptions} onSaved={onFieldUpdated} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: RUNWAY & FACILITIES
// ═══════════════════════════════════════════════════════════════════════════

function RunwayFacilitiesTab({ airport, onFieldUpdated }: { airport: AirportWithCountry; onFieldUpdated: () => void }) {
  return (
    <div className="space-y-4">
      <RunwaysSection airportId={airport.id} />
      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Airport Info</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
          <InlineField label="Fire Category" field="fire_category" value={airport.fire_category?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} type="number" />
          <InlineField label="Airport Authority" field="airport_authority" value={airport.airport_authority || ''} airportId={airport.id} onSaved={onFieldUpdated} />
          <InlineToggle label="Fuel Available" field="fuel_available" value={airport.fuel_available ?? true} airportId={airport.id} onSaved={onFieldUpdated} />
        </div>
      </div>
      <TerminalsSection airportId={airport.id} />
      <FrequenciesSection airportId={airport.id} />
    </div>
  )
}

// ─── Runways Sub-Table ──────────────────────────────────────────────────

function RunwaysSection({ airportId }: { airportId: string }) {
  const [runways, setRunways] = useState<AirportRunway[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setRunways(await getRunways(airportId))
    setLoading(false)
  }, [airportId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Runways</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Runway</Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
      ) : runways.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">No runways configured.</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Identifier</th>
                <th className="text-left py-2 px-2 font-medium">Length (m)</th>
                <th className="text-left py-2 px-2 font-medium">Width (m)</th>
                <th className="text-left py-2 px-2 font-medium">Surface</th>
                <th className="text-left py-2 px-2 font-medium">ILS Cat</th>
                <th className="text-left py-2 px-2 font-medium">Lighting</th>
                <th className="text-left py-2 px-2 font-medium">Status</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runways.map((rwy) => (
                <RunwayRow key={rwy.id} runway={rwy} onUpdated={fetchData} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RunwayFormDialog open={addOpen} onOpenChange={setAddOpen} airportId={airportId} onSaved={fetchData} />
    </div>
  )
}

function RunwayRow({ runway, onUpdated }: { runway: AirportRunway; onUpdated: () => void }) {
  const handleDelete = async () => {
    if (!confirm(`Delete runway ${runway.identifier}?`)) return
    const result = await deleteRunway(runway.id)
    if (result?.error) alert(result.error)
    else onUpdated()
  }

  return (
    <tr className="border-b border-white/5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
      <td className="py-2.5 px-2 font-mono text-xs font-bold">{runway.identifier}</td>
      <td className="py-2.5 px-2 font-mono text-xs">{runway.length_m ?? '—'}</td>
      <td className="py-2.5 px-2 font-mono text-xs">{runway.width_m ?? '—'}</td>
      <td className="py-2.5 px-2 text-xs">{runway.surface || '—'}</td>
      <td className="py-2.5 px-2 text-xs">{runway.ils_category || '—'}</td>
      <td className="py-2.5 px-2 text-xs">{runway.lighting ? 'Yes' : 'No'}</td>
      <td className="py-2.5 px-2 text-xs capitalize">{runway.status}</td>
      <td className="py-2.5 px-2 text-right">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </td>
    </tr>
  )
}

function RunwayFormDialog({ open, onOpenChange, airportId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; airportId: string; onSaved: () => void }) {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await createRunway({
      airport_id: airportId,
      identifier: fd.get('identifier') as string,
      length_m: fd.get('length_m') ? Number(fd.get('length_m')) : null,
      width_m: fd.get('width_m') ? Number(fd.get('width_m')) : null,
      surface: fd.get('surface') as string || null,
      ils_category: fd.get('ils_category') as string || null,
    })
    setLoading(false)
    if (result?.error) alert(result.error)
    else { onOpenChange(false); onSaved() }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Runway</DialogTitle>
          <DialogDescription>Add a new runway to this airport.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-medium">Identifier</label><Input name="identifier" placeholder="09L/27R" required className="font-mono" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Length (m)</label><Input name="length_m" type="number" placeholder="3800" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Width (m)</label><Input name="width_m" type="number" placeholder="45" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">Surface</label><Input name="surface" placeholder="Asphalt" /></div>
            <div className="space-y-1"><label className="text-xs font-medium">ILS Category</label><Input name="ils_category" placeholder="CAT III" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Add Runway'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Terminals Sub-Table ────────────────────────────────────────────────

function TerminalsSection({ airportId }: { airportId: string }) {
  const [terminals, setTerminals] = useState<AirportTerminal[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setTerminals(await getTerminals(airportId))
    setLoading(false)
  }, [airportId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Terminals</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Terminal</Button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : terminals.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">No terminals configured.</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Code</th>
                <th className="text-left py-2 px-2 font-medium">Name</th>
                <th className="text-left py-2 px-2 font-medium">Notes</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {terminals.map((t) => (
                <tr key={t.id} className="border-b border-white/5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-2 font-mono text-xs font-bold">{t.code}</td>
                  <td className="py-2.5 px-2 text-xs">{t.name || '—'}</td>
                  <td className="py-2.5 px-2 text-xs text-muted-foreground">{t.notes || '—'}</td>
                  <td className="py-2.5 px-2 text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={async () => {
                      if (!confirm(`Delete terminal ${t.code}?`)) return
                      const r = await deleteTerminal(t.id)
                      if (r?.error) alert(r.error); else fetchData()
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Terminal</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const r = await createTerminal({ airport_id: airportId, code: fd.get('code') as string, name: fd.get('name') as string || null, notes: fd.get('notes') as string || null })
            if (r?.error) alert(r.error); else { setAddOpen(false); fetchData() }
          }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><label className="text-xs font-medium">Code</label><Input name="code" placeholder="T1" required className="font-mono" /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Name</label><Input name="name" placeholder="Terminal 1" /></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium">Notes</label><Input name="notes" placeholder="Optional notes..." /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit">Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Frequencies Sub-Table ──────────────────────────────────────────────

const FREQ_TYPES = ['Tower', 'Ground', 'Approach', 'Departure', 'ATIS', 'Emergency']

function FrequenciesSection({ airportId }: { airportId: string }) {
  const [freqs, setFreqs] = useState<AirportFrequency[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setFreqs(await getFrequencies(airportId))
    setLoading(false)
  }, [airportId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Frequencies</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Frequency</Button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : freqs.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">No frequencies configured.</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Type</th>
                <th className="text-left py-2 px-2 font-medium">Frequency</th>
                <th className="text-left py-2 px-2 font-medium">Notes</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {freqs.map((f) => (
                <tr key={f.id} className="border-b border-white/5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-2 text-xs font-medium">{f.type}</td>
                  <td className="py-2.5 px-2 font-mono text-xs font-semibold">{f.frequency}</td>
                  <td className="py-2.5 px-2 text-xs text-muted-foreground">{f.notes || '—'}</td>
                  <td className="py-2.5 px-2 text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={async () => {
                      if (!confirm(`Delete frequency ${f.frequency}?`)) return
                      const r = await deleteFrequency(f.id)
                      if (r?.error) alert(r.error); else fetchData()
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Frequency</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const r = await createFrequency({ airport_id: airportId, type: fd.get('type') as string, frequency: fd.get('frequency') as string, notes: fd.get('notes') as string || null })
            if (r?.error) alert(r.error); else { setAddOpen(false); fetchData() }
          }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Type</label>
                <Select name="type" defaultValue="Tower">
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent className="glass-heavy">
                    {FREQ_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">Frequency</label><Input name="frequency" placeholder="118.700" required className="font-mono" /></div>
            </div>
            <div className="space-y-1"><label className="text-xs font-medium">Notes</label><Input name="notes" placeholder="Optional notes..." /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit">Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

function OperationsTab({ airport, onFieldUpdated }: { airport: AirportWithCountry; onFieldUpdated: () => void }) {
  const slotOptions = [
    { value: 'Level 1', label: 'Level 1 — Non-coordinated' },
    { value: 'Level 2', label: 'Level 2 — Facilitated' },
    { value: 'Level 3', label: 'Level 3 — Coordinated' },
  ]

  const isCoordinated = airport.slot_classification === 'Level 2' || airport.slot_classification === 'Level 3'

  return (
    <div className="space-y-4">
      {/* Slot Management */}
      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Slot Management</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
          <InlineSelectField label="Classification" field="slot_classification" value={airport.slot_classification || ''} airportId={airport.id} options={slotOptions} onSaved={onFieldUpdated} />
          {isCoordinated && (
            <InlineField label="Coordinator Contact" field="slot_coordinator_contact" value={airport.slot_coordinator_contact || ''} airportId={airport.id} onSaved={onFieldUpdated} />
          )}
          <InlineField label="Departure Tolerance Early (min)" field="slot_departure_tolerance_early" value={airport.slot_departure_tolerance_early?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
          <InlineField label="Departure Tolerance Late (min)" field="slot_departure_tolerance_late" value={airport.slot_departure_tolerance_late?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
          <InlineField label="Arrival Tolerance Early (min)" field="slot_arrival_tolerance_early" value={airport.slot_arrival_tolerance_early?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
          <InlineField label="Arrival Tolerance Late (min)" field="slot_arrival_tolerance_late" value={airport.slot_arrival_tolerance_late?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
        </div>
      </div>

      {/* Operating Hours */}
      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Operating Hours</h3>
        <InlineToggle label="24-Hour Operations" field="is_24_hour" value={airport.is_24_hour ?? true} airportId={airport.id} onSaved={onFieldUpdated} />
        {!airport.is_24_hour && (
          <div className="grid grid-cols-2 gap-x-6">
            <InlineField label="Opens" field="operating_hours_open" value={airport.operating_hours_open || ''} airportId={airport.id} onSaved={onFieldUpdated} mono />
            <InlineField label="Closes" field="operating_hours_close" value={airport.operating_hours_close || ''} airportId={airport.id} onSaved={onFieldUpdated} mono />
          </div>
        )}
      </div>

      {/* Curfews */}
      <CurfewsSection airportId={airport.id} />

      {/* Ground Handling */}
      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Ground Handling</h3>
        <InlineToggle label="Self-handling Permitted" field="self_handling_permitted" value={airport.self_handling_permitted ?? true} airportId={airport.id} onSaved={onFieldUpdated} />
      </div>
    </div>
  )
}

// ─── Curfews Sub-Table ──────────────────────────────────────────────────

const DAYS_OPTIONS = ['All', 'Mon-Fri', 'Sat-Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const EXCEPTION_OPTIONS = ['None', 'Cargo Only', 'Emergency Only']

function CurfewsSection({ airportId }: { airportId: string }) {
  const [curfews, setCurfews] = useState<AirportCurfew[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setCurfews(await getCurfews(airportId))
    setLoading(false)
  }, [airportId])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Curfew Times</h3>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Curfew</Button>
      </div>

      {loading ? (
        <div className="text-center py-4 text-muted-foreground text-sm">Loading...</div>
      ) : curfews.length === 0 ? (
        <div className="text-center py-4 text-muted-foreground text-sm">No curfews configured.</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">Days</th>
                <th className="text-left py-2 px-2 font-medium">No Ops From</th>
                <th className="text-left py-2 px-2 font-medium">No Ops Until</th>
                <th className="text-left py-2 px-2 font-medium">Exception</th>
                <th className="text-left py-2 px-2 font-medium">Notes</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {curfews.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-2 text-xs">{c.days}</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{c.no_ops_from?.slice(0, 5)}</td>
                  <td className="py-2.5 px-2 font-mono text-xs">{c.no_ops_until?.slice(0, 5)}</td>
                  <td className="py-2.5 px-2 text-xs">{c.exception || '—'}</td>
                  <td className="py-2.5 px-2 text-xs text-muted-foreground">{c.notes || '—'}</td>
                  <td className="py-2.5 px-2 text-right">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={async () => {
                      if (!confirm('Delete this curfew?')) return
                      const r = await deleteCurfew(c.id)
                      if (r?.error) alert(r.error); else fetchData()
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Curfew</DialogTitle></DialogHeader>
          <form onSubmit={async (e) => {
            e.preventDefault()
            const fd = new FormData(e.currentTarget)
            const exc = fd.get('exception') as string
            const r = await createCurfew({
              airport_id: airportId,
              days: fd.get('days') as string || 'All',
              no_ops_from: fd.get('no_ops_from') as string,
              no_ops_until: fd.get('no_ops_until') as string,
              exception: exc === 'None' ? null : exc,
              notes: fd.get('notes') as string || null,
            })
            if (r?.error) alert(r.error); else { setAddOpen(false); fetchData() }
          }} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Days</label>
                <select name="days" className="w-full h-8 text-sm rounded-md border bg-background px-2" defaultValue="All">
                  {DAYS_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">From</label><Input name="no_ops_from" type="time" required className="font-mono" /></div>
              <div className="space-y-1"><label className="text-xs font-medium">Until</label><Input name="no_ops_until" type="time" required className="font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Exception</label>
                <select name="exception" className="w-full h-8 text-sm rounded-md border bg-background px-2" defaultValue="None">
                  {EXCEPTION_OPTIONS.map((e) => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div className="space-y-1"><label className="text-xs font-medium">Notes</label><Input name="notes" /></div>
            </div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit">Add</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: WEATHER LIMITATIONS
// ═══════════════════════════════════════════════════════════════════════════

const WEATHER_DEFAULTS: { limitation_type: string; label: string; unit: string }[] = [
  { limitation_type: 'ceiling', label: 'Ceiling', unit: 'ft' },
  { limitation_type: 'rvr', label: 'RVR', unit: 'm' },
  { limitation_type: 'visibility', label: 'Visibility', unit: 'm' },
  { limitation_type: 'crosswind', label: 'Crosswind', unit: 'kt' },
  { limitation_type: 'wind', label: 'Wind', unit: 'kt' },
  { limitation_type: 'takeoff_minimum', label: 'Takeoff Minimum', unit: 'm' },
  { limitation_type: 'tailwind', label: 'Tailwind', unit: 'kt' },
]

function WeatherTab({ airport, onFieldUpdated }: { airport: AirportWithCountry; onFieldUpdated: () => void }) {
  const [limits, setLimits] = useState<AirportWeatherLimit[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setLimits(await getWeatherLimits(airport.id))
    setLoading(false)
  }, [airport.id])

  useEffect(() => { fetchData() }, [fetchData])

  // Merge defaults with existing data
  const rows = useMemo(() => {
    return WEATHER_DEFAULTS.map((def) => {
      const existing = limits.find((l) => l.limitation_type === def.limitation_type)
      return {
        limitation_type: def.limitation_type,
        label: def.label,
        unit: def.unit,
        warning_value: existing?.warning_value ?? null,
        alert_value: existing?.alert_value ?? null,
        id: existing?.id,
      }
    })
  }, [limits])

  const handleSave = async (limitation_type: string, unit: string, warning_value: number | null, alert_value: number | null) => {
    await upsertWeatherLimit({ airport_id: airport.id, limitation_type, unit, warning_value, alert_value })
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-4">
        <h3 className="text-sm font-semibold">Weather Limitations</h3>
        {loading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 px-2 font-medium">Limitation</th>
                  <th className="text-left py-2 px-2 font-medium">Warning</th>
                  <th className="text-left py-2 px-2 font-medium">Alert</th>
                  <th className="text-left py-2 px-2 font-medium">Unit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <WeatherRow key={row.limitation_type} row={row} onSave={handleSave} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">ILS & LVO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
          <InlineField label="ILS Category" field="ils_category" value={airport.ils_category || ''} airportId={airport.id} onSaved={onFieldUpdated} />
          <InlineField label="Special Notes" field="special_notes" value={airport.special_notes || ''} airportId={airport.id} onSaved={onFieldUpdated} />
        </div>
      </div>
    </div>
  )
}

function WeatherRow({ row, onSave }: {
  row: { limitation_type: string; label: string; unit: string; warning_value: number | null; alert_value: number | null }
  onSave: (type: string, unit: string, w: number | null, a: number | null) => void
}) {
  const [warning, setWarning] = useState(row.warning_value?.toString() || '')
  const [alert, setAlert] = useState(row.alert_value?.toString() || '')

  useEffect(() => {
    setWarning(row.warning_value?.toString() || '')
    setAlert(row.alert_value?.toString() || '')
  }, [row.warning_value, row.alert_value])

  const handleBlur = () => {
    const w = warning ? Number(warning) : null
    const a = alert ? Number(alert) : null
    if (w !== row.warning_value || a !== row.alert_value) {
      onSave(row.limitation_type, row.unit, w, a)
    }
  }

  return (
    <tr className="border-b border-white/5">
      <td className="py-2.5 px-2 text-xs font-medium">{row.label}</td>
      <td className="py-2.5 px-2">
        <Input value={warning} onChange={(e) => setWarning(e.target.value)} onBlur={handleBlur}
          type="number" className="h-7 text-xs font-mono w-24" placeholder="—" />
      </td>
      <td className="py-2.5 px-2">
        <Input value={alert} onChange={(e) => setAlert(e.target.value)} onBlur={handleBlur}
          type="number" className="h-7 text-xs font-mono w-24" placeholder="—" />
      </td>
      <td className="py-2.5 px-2 text-xs text-muted-foreground">{row.unit}</td>
    </tr>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 5: TURN AROUND TIMES
// ═══════════════════════════════════════════════════════════════════════════

function TatTab({ airport, aircraftTypes }: { airport: AirportWithCountry; aircraftTypes: AircraftType[] }) {
  const [rules, setRules] = useState<TatRuleWithType[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setRules(await getTatRulesForAirport(airport.id))
    setLoading(false)
  }, [airport.id])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="glass rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Turn Around Times</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Airport Turn Around Time overrides Aircraft Type defaults. Leave blank to use aircraft type defaults.
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Rule</Button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-muted-foreground text-sm">Loading...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm">No Turn Around Time rules configured. Using aircraft type defaults.</div>
      ) : (
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-muted-foreground">
                <th className="text-left py-2 px-2 font-medium">A/C Type</th>
                <th className="text-left py-2 px-2 font-medium">Default</th>
                <th className="text-left py-2 px-2 font-medium">Commercial</th>
                <th className="text-left py-2 px-2 font-medium">DOM→DOM</th>
                <th className="text-left py-2 px-2 font-medium">DOM→INT</th>
                <th className="text-left py-2 px-2 font-medium">INT→DOM</th>
                <th className="text-left py-2 px-2 font-medium">INT→INT</th>
                <th className="text-right py-2 px-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <TatRow key={rule.id} rule={rule} onUpdated={fetchData} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TatFormDialog open={addOpen} onOpenChange={setAddOpen} airportId={airport.id} aircraftTypes={aircraftTypes} existingTypeIds={rules.map((r) => r.aircraft_type_id)} onSaved={fetchData} />
    </div>
  )
}

function TatRow({ rule, onUpdated }: { rule: TatRuleWithType; onUpdated: () => void }) {
  return (
    <tr className="border-b border-white/5 hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
      <td className="py-2.5 px-2 text-xs font-semibold">{rule.aircraft_types?.icao_type} <span className="text-muted-foreground font-normal">{rule.aircraft_types?.name}</span></td>
      <td className="py-2.5 px-2 font-mono text-xs text-muted-foreground">{minutesToHHMM(rule.aircraft_types?.default_tat_minutes) || '—'}</td>
      <td className="py-2.5 px-2 font-mono text-xs font-semibold">{minutesToHHMM(rule.tat_minutes) || '—'}</td>
      <td className="py-2.5 px-2 font-mono text-xs">{minutesToHHMM(rule.tat_dom_dom_minutes) || '—'}</td>
      <td className="py-2.5 px-2 font-mono text-xs">{minutesToHHMM(rule.tat_dom_int_minutes) || '—'}</td>
      <td className="py-2.5 px-2 font-mono text-xs">{minutesToHHMM(rule.tat_int_dom_minutes) || '—'}</td>
      <td className="py-2.5 px-2 font-mono text-xs">{minutesToHHMM(rule.tat_int_int_minutes) || '—'}</td>
      <td className="py-2.5 px-2 text-right">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={async () => {
          if (!confirm(`Delete Turn Around Time rule for ${rule.aircraft_types?.icao_type}?`)) return
          const r = await deleteTatRule(rule.id)
          if (r?.error) alert(r.error); else onUpdated()
        }}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </td>
    </tr>
  )
}

function TatFormDialog({ open, onOpenChange, airportId, aircraftTypes, existingTypeIds, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; airportId: string
  aircraftTypes: AircraftType[]; existingTypeIds: string[]; onSaved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const available = aircraftTypes.filter((at) => at.is_active && !existingTypeIds.includes(at.id))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await createTatRule({
      airport_id: airportId,
      aircraft_type_id: fd.get('aircraft_type_id') as string,
      tat_minutes: hhmmToMinutes(fd.get('tat_minutes') as string || '') ?? 0,
      tat_dom_dom_minutes: hhmmToMinutes(fd.get('tat_dom_dom') as string || '') ?? null,
      tat_dom_int_minutes: hhmmToMinutes(fd.get('tat_dom_int') as string || '') ?? null,
      tat_int_dom_minutes: hhmmToMinutes(fd.get('tat_int_dom') as string || '') ?? null,
      tat_int_int_minutes: hhmmToMinutes(fd.get('tat_int_int') as string || '') ?? null,
      notes: fd.get('notes') as string || null,
    })
    setLoading(false)
    if (result?.error) alert(result.error)
    else { onOpenChange(false); onSaved() }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Turn Around Time Rule</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium">Aircraft Type</label>
            <select name="aircraft_type_id" required className="w-full h-8 text-sm rounded-md border bg-background px-2">
              <option value="">Select aircraft type...</option>
              {available.map((at) => <option key={at.id} value={at.id}>{at.icao_type} — {at.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="space-y-1"><label className="text-[10px] font-medium">Commercial</label><Input name="tat_minutes" type="text" required className="font-mono h-8 text-xs" placeholder="HH:MM" /></div>
            <div className="space-y-1"><label className="text-[10px] font-medium">DOM→DOM</label><Input name="tat_dom_dom" type="text" className="font-mono h-8 text-xs" placeholder="HH:MM" /></div>
            <div className="space-y-1"><label className="text-[10px] font-medium">DOM→INT</label><Input name="tat_dom_int" type="text" className="font-mono h-8 text-xs" placeholder="HH:MM" /></div>
            <div className="space-y-1"><label className="text-[10px] font-medium">INT→DOM</label><Input name="tat_int_dom" type="text" className="font-mono h-8 text-xs" placeholder="HH:MM" /></div>
            <div className="space-y-1"><label className="text-[10px] font-medium">INT→INT</label><Input name="tat_int_int" type="text" className="font-mono h-8 text-xs" placeholder="HH:MM" /></div>
          </div>
          <div className="space-y-1"><label className="text-xs font-medium">Notes</label><Input name="notes" placeholder="Optional notes..." /></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Add Rule'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 6: CREW
// ═══════════════════════════════════════════════════════════════════════════

function CrewTab({ airport, onFieldUpdated }: { airport: AirportWithCountry; onFieldUpdated: () => void }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Reporting Times</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
          <InlineField label="Crew Reporting Before STD (min)" field="crew_reporting_time_minutes" value={airport.crew_reporting_time_minutes?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
          <InlineField label="Crew Debrief After STA (min)" field="crew_debrief_time_minutes" value={airport.crew_debrief_time_minutes?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
          <InlineField label="Positioning Crew Reporting (min)" field="crew_positioning_reporting_minutes" value={airport.crew_positioning_reporting_minutes?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
        </div>
      </div>

      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Base Info</h3>
        <InlineToggle label="Is Home Base" field="is_home_base" value={airport.is_home_base ?? false} airportId={airport.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Is Crew Base" field="is_crew_base" value={airport.is_crew_base ?? false} airportId={airport.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Crew Lounge Available" field="crew_lounge_available" value={airport.crew_lounge_available ?? false} airportId={airport.id} onSaved={onFieldUpdated} />
        <InlineToggle label="Rest Facility Available" field="rest_facility_available" value={airport.rest_facility_available ?? false} airportId={airport.id} onSaved={onFieldUpdated} description="For split duty rest" />
      </div>

      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Special Notes</h3>
        <InlineField label="Notes" field="special_notes" value={airport.special_notes || ''} airportId={airport.id} onSaved={onFieldUpdated} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 7: DIVERSIONS
// ═══════════════════════════════════════════════════════════════════════════

function DiversionsTab({ airport, onFieldUpdated }: { airport: AirportWithCountry; onFieldUpdated: () => void }) {
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Diversion Restrictions</h3>
        <InlineToggle label="Cannot Be Used For Diversion" field="cannot_be_used_for_diversion" value={airport.cannot_be_used_for_diversion ?? false} airportId={airport.id} onSaved={onFieldUpdated} />
        {airport.cannot_be_used_for_diversion && (
          <InlineField label="Reason" field="notes" value={airport.notes || ''} airportId={airport.id} onSaved={onFieldUpdated} />
        )}
      </div>

      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">ETOPS</h3>
        <InlineToggle label="Is ETOPS Alternate" field="is_etops_alternate" value={airport.is_etops_alternate ?? false} airportId={airport.id} onSaved={onFieldUpdated} />
        {airport.is_etops_alternate && (
          <InlineField label="ETOPS Diversion Time (min)" field="etops_diversion_minutes" value={airport.etops_diversion_minutes?.toString() || ''} airportId={airport.id} onSaved={onFieldUpdated} mono type="number" />
        )}
      </div>

      <div className="glass rounded-2xl p-5 space-y-1">
        <h3 className="text-sm font-semibold mb-3">Notes</h3>
        <InlineField label="Special Notes" field="special_notes" value={airport.special_notes || ''} airportId={airport.id} onSaved={onFieldUpdated} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// INQUIRY MODAL
// ═══════════════════════════════════════════════════════════════════════════

interface BasicFieldRow {
  key: 'latitude' | 'longitude' | 'elevation_ft'
  label: string
  current: number | null
  found: number | null
  status: 'new' | 'match' | 'differ'
}

function InquiryModal({
  open, onOpenChange, airportId, icaoCode, iataCode, data, currentAirport, existingRunways, existingFreqs, onApplied,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  airportId: string
  icaoCode: string
  iataCode: string | null
  data: InquiryResult | null
  currentAirport: AirportWithCountry
  existingRunways: AirportRunway[]
  existingFreqs: AirportFrequency[]
  onApplied: () => void
}) {
  // Per-row selection state for basic info fields
  const [selectedBasicFields, setSelectedBasicFields] = useState<Set<string>>(new Set())
  // Per-row selection state for runways (by index)
  const [selectedRunways, setSelectedRunways] = useState<Set<number>>(new Set())
  // Per-row selection state for frequencies (by index)
  const [selectedFrequencies, setSelectedFrequencies] = useState<Set<number>>(new Set())
  const [applying, setApplying] = useState(false)

  // Build basic info comparison rows
  const basicRows = useMemo((): BasicFieldRow[] => {
    if (!data?.basicInfo) return []
    const rows: BasicFieldRow[] = []
    const fields: { key: 'latitude' | 'longitude' | 'elevation_ft'; label: string }[] = [
      { key: 'latitude', label: 'Latitude' },
      { key: 'longitude', label: 'Longitude' },
      { key: 'elevation_ft', label: 'Elevation (ft)' },
    ]
    for (const f of fields) {
      const found = data.basicInfo![f.key]
      if (found == null) continue
      const current = currentAirport[f.key] as number | null
      let status: BasicFieldRow['status'] = 'new'
      if (current != null) {
        // For lat/lon, compare to 4 decimal places; for elevation, exact
        if (f.key === 'elevation_ft') {
          status = current === found ? 'match' : 'differ'
        } else {
          status = Math.abs(current - found) < 0.0001 ? 'match' : 'differ'
        }
      }
      rows.push({ key: f.key, label: f.label, current, found, status })
    }
    return rows
  }, [data, currentAirport])

  // Build runway status: which ones already exist
  const runwayStatuses = useMemo(() => {
    if (!data?.runways) return []
    const existingIds = new Set(existingRunways.map((r) => r.identifier))
    return data.runways.map((r) => ({
      ...r,
      exists: existingIds.has(r.identifier),
    }))
  }, [data, existingRunways])

  // Build frequency status: which ones already exist
  const freqStatuses = useMemo(() => {
    if (!data?.frequencies) return []
    const existingKeys = new Set(existingFreqs.map((f) => `${f.type}::${f.frequency}`))
    return data.frequencies.map((f) => ({
      ...f,
      exists: existingKeys.has(`${f.type}::${f.frequency}`),
    }))
  }, [data, existingFreqs])

  // Reset selections when modal opens
  useEffect(() => {
    if (!open) return
    // Auto-select importable items
    const bf = new Set<string>()
    basicRows.forEach((r) => { if (r.status === 'new' || r.status === 'differ') bf.add(r.key) })
    setSelectedBasicFields(bf)

    const sr = new Set<number>()
    runwayStatuses.forEach((r, i) => { if (!r.exists) sr.add(i) })
    setSelectedRunways(sr)

    const sf = new Set<number>()
    freqStatuses.forEach((f, i) => { if (!f.exists) sf.add(i) })
    setSelectedFrequencies(sf)
  }, [open, basicRows, runwayStatuses, freqStatuses])

  // Count what will be applied
  const basicCount = selectedBasicFields.size
  const rwyCount = Array.from(selectedRunways).filter((i) => !runwayStatuses[i]?.exists).length
  const freqCount = Array.from(selectedFrequencies).filter((i) => !freqStatuses[i]?.exists).length
  const totalActions = basicCount + rwyCount + freqCount

  const toggleBasicField = (key: string) => {
    setSelectedBasicFields((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  const toggleRunway = (idx: number) => {
    setSelectedRunways((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const toggleFrequency = (idx: number) => {
    setSelectedFrequencies((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }

  const handleApply = async () => {
    setApplying(true)

    // Build basic fields to update
    const basicFields: { latitude?: number | null; longitude?: number | null; elevation_ft?: number | null } = {}
    for (const row of basicRows) {
      if (selectedBasicFields.has(row.key) && row.found != null && row.status !== 'match') {
        basicFields[row.key] = row.found
      }
    }
    const hasBasic = Object.keys(basicFields).length > 0

    // Build runways to import (only non-existing, selected)
    const runwaysToImport: InquiryRunway[] = []
    Array.from(selectedRunways).forEach((idx) => {
      const r = runwayStatuses[idx]
      if (r && !r.exists) {
        const { exists, ...runway } = r
        runwaysToImport.push(runway)
      }
    })

    // Build frequencies to import (only non-existing, selected)
    const freqsToImport: InquiryFrequency[] = []
    Array.from(selectedFrequencies).forEach((idx) => {
      const f = freqStatuses[idx]
      if (f && !f.exists) {
        const { exists, ...freq } = f
        freqsToImport.push(freq)
      }
    })

    const result = await applyInquiryData(airportId, {
      basicFields: hasBasic ? basicFields : undefined,
      runways: runwaysToImport.length > 0 ? runwaysToImport : undefined,
      frequencies: freqsToImport.length > 0 ? freqsToImport : undefined,
    })

    setApplying(false)

    if (result && 'error' in result) {
      toast.error('Apply failed', { description: result.error })
    } else if (result && 'success' in result) {
      const r = result.results
      const parts: string[] = []
      if (r.fieldsUpdated > 0) parts.push(`${r.fieldsUpdated} field${r.fieldsUpdated > 1 ? 's' : ''}`)
      if (r.runwaysImported > 0) parts.push(`${r.runwaysImported} runway${r.runwaysImported > 1 ? 's' : ''}`)
      if (r.frequenciesImported > 0) parts.push(`${r.frequenciesImported} frequenc${r.frequenciesImported > 1 ? 'ies' : 'y'}`)
      toast.success(`Updated ${iataCode || icaoCode}`, {
        description: parts.length > 0 ? parts.join(', ') : 'No changes needed',
      })
      onOpenChange(false)
      onApplied()
    }
  }

  if (!data) return null

  // Error / not found state
  if (!data.found) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Satellite className="h-5 w-5" /> Airport Inquiry — {iataCode || icaoCode}
            </DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center space-y-3">
            <div className="text-4xl">
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 opacity-60" />
            </div>
            <p className="text-sm text-muted-foreground">
              {data.error || `No data found for ${icaoCode}. You can enter data manually.`}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Satellite className="h-5 w-5" /> Airport Inquiry — {iataCode || icaoCode}
          </DialogTitle>
          <DialogDescription>
            Data found from OurAirports database{data.basicInfo?.name ? ` — ${data.basicInfo.name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1">
          {/* ─── SECTION 1: BASIC INFO ─── */}
          {basicRows.length > 0 && (
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Basic Info Updates</h4>
                <Badge variant="secondary" className="text-[10px]">
                  {basicRows.filter((r) => r.status !== 'match').length} change{basicRows.filter((r) => r.status !== 'match').length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="text-left py-1.5 px-2 font-medium w-8">Update?</th>
                      <th className="text-left py-1.5 px-2 font-medium">Field</th>
                      <th className="text-left py-1.5 px-2 font-medium">Current Value</th>
                      <th className="text-left py-1.5 px-2 font-medium">Found Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {basicRows.map((row) => (
                      <tr key={row.key} className={cn(
                        'border-b border-white/5',
                        row.status === 'differ' && 'bg-amber-500/5'
                      )}>
                        <td className="py-2 px-2">
                          {row.status === 'match' ? (
                            <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Match
                            </Badge>
                          ) : (
                            <Checkbox
                              checked={selectedBasicFields.has(row.key)}
                              onCheckedChange={() => toggleBasicField(row.key)}
                            />
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium">{row.label}</td>
                        <td className="py-2 px-2 font-mono text-muted-foreground">
                          {row.current != null ? (row.key === 'elevation_ft' ? row.current : row.current.toFixed(6)) : <span className="italic">(empty)</span>}
                        </td>
                        <td className={cn(
                          'py-2 px-2 font-mono',
                          row.status === 'new' && 'text-green-600 dark:text-green-400',
                          row.status === 'differ' && 'text-amber-600 dark:text-amber-400',
                        )}>
                          {row.found != null ? (row.key === 'elevation_ft' ? `${row.found} ft` : row.found.toFixed(6)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── SECTION 2: RUNWAYS ─── */}
          {runwayStatuses.length > 0 && (
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Runways Found</h4>
                <Badge variant="secondary" className="text-[10px]">{runwayStatuses.length} found</Badge>
                {runwayStatuses.filter((r) => r.exists).length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    {runwayStatuses.filter((r) => r.exists).length} already exist
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="text-left py-1.5 px-2 font-medium w-8">Import?</th>
                      <th className="text-left py-1.5 px-2 font-medium">Identifier</th>
                      <th className="text-left py-1.5 px-2 font-medium">Length (m)</th>
                      <th className="text-left py-1.5 px-2 font-medium">Width (m)</th>
                      <th className="text-left py-1.5 px-2 font-medium">Surface</th>
                      <th className="text-left py-1.5 px-2 font-medium">Lighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runwayStatuses.map((r, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 px-2">
                          {r.exists ? (
                            <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Exists
                            </Badge>
                          ) : (
                            <Checkbox
                              checked={selectedRunways.has(i)}
                              onCheckedChange={() => toggleRunway(i)}
                            />
                          )}
                        </td>
                        <td className="py-2 px-2 font-mono font-bold">{r.identifier}</td>
                        <td className="py-2 px-2 font-mono">{r.length_m ?? '—'}</td>
                        <td className="py-2 px-2 font-mono">{r.width_m ?? '—'}</td>
                        <td className="py-2 px-2">{r.surface || '—'}</td>
                        <td className="py-2 px-2">{r.lighting ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── SECTION 3: FREQUENCIES ─── */}
          {freqStatuses.length > 0 && (
            <div className="glass rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Frequencies Found</h4>
                <Badge variant="secondary" className="text-[10px]">{freqStatuses.length} found</Badge>
                {freqStatuses.filter((f) => f.exists).length > 0 && (
                  <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                    {freqStatuses.filter((f) => f.exists).length} already exist
                  </Badge>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-muted-foreground">
                      <th className="text-left py-1.5 px-2 font-medium w-8">Import?</th>
                      <th className="text-left py-1.5 px-2 font-medium">Type</th>
                      <th className="text-left py-1.5 px-2 font-medium">Frequency</th>
                      <th className="text-left py-1.5 px-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freqStatuses.map((f, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-2 px-2">
                          {f.exists ? (
                            <Badge variant="secondary" className="text-[9px] gap-0.5 px-1.5 bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                              <CheckCircle2 className="h-2.5 w-2.5" /> Exists
                            </Badge>
                          ) : (
                            <Checkbox
                              checked={selectedFrequencies.has(i)}
                              onCheckedChange={() => toggleFrequency(i)}
                            />
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium">{f.type}</td>
                        <td className="py-2 px-2 font-mono font-semibold">{f.frequency}</td>
                        <td className="py-2 px-2 text-muted-foreground truncate max-w-[200px]">{f.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No data sections */}
          {basicRows.length === 0 && runwayStatuses.length === 0 && freqStatuses.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No new data to apply — airport data is already up to date.
            </div>
          )}
        </div>

        {/* ─── FOOTER WITH SUMMARY ─── */}
        <div className="shrink-0 pt-3 border-t border-white/10">
          {totalActions > 0 && (
            <p className="text-xs text-muted-foreground mb-3">
              Will {basicCount > 0 ? `update ${basicCount} field${basicCount > 1 ? 's' : ''}` : ''}
              {basicCount > 0 && rwyCount > 0 ? ', ' : ''}
              {rwyCount > 0 ? `import ${rwyCount} runway${rwyCount > 1 ? 's' : ''}` : ''}
              {(basicCount > 0 || rwyCount > 0) && freqCount > 0 ? ', ' : ''}
              {freqCount > 0 ? `import ${freqCount} frequenc${freqCount > 1 ? 'ies' : 'y'}` : ''}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Cancel</Button>
            <Button onClick={handleApply} disabled={applying || totalActions === 0}>
              {applying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply Selected'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD AIRPORT MODAL — Search + Import from OurAirports or Create Manually
// ═══════════════════════════════════════════════════════════════════════════

type AddStep = 'search' | 'preview' | 'manual'

function AddAirportModal({
  open, onOpenChange, existingAirports, onImported,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  existingAirports: AirportWithCountry[]
  onImported: () => void
}) {
  const [step, setStep] = useState<AddStep>('search')
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [inquiryData, setInquiryData] = useState<InquiryResult | null>(null)
  const [existingMatch, setExistingMatch] = useState<AirportWithCountry | null>(null)
  const [manualError, setManualError] = useState<string | null>(null)
  const [manualLoading, setManualLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('search')
      setCode('')
      setSearching(false)
      setImporting(false)
      setInquiryData(null)
      setExistingMatch(null)
      setManualError(null)
      setManualLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSearch = async () => {
    const upper = code.toUpperCase().trim()
    if (!upper || upper.length < 3 || upper.length > 4) return

    // Check existing airports first
    const match = existingAirports.find((a) =>
      a.icao_code === upper || a.iata_code === upper
    )
    if (match) {
      setExistingMatch(match)
      return
    }

    setSearching(true)
    setExistingMatch(null)
    const data = await inquireAirport(upper)
    setInquiryData(data)
    setSearching(false)
    if (data.found) {
      setStep('preview')
    }
    // If not found, stays on search step showing error
  }

  const handleImport = async () => {
    if (!inquiryData?.basicInfo) return
    setImporting(true)
    const result = await importNewAirport({
      basicInfo: inquiryData.basicInfo,
      runways: inquiryData.runways,
      frequencies: inquiryData.frequencies,
    })
    setImporting(false)
    if ('error' in result) {
      toast.error('Import failed', { description: result.error })
    } else {
      const name = inquiryData.basicInfo.name || inquiryData.basicInfo.icao_code
      const label = inquiryData.basicInfo.iata_code || inquiryData.basicInfo.icao_code
      toast.success(`Imported ${label}`, { description: name || undefined })
      onOpenChange(false)
      onImported()
    }
  }

  const handleManualSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setManualLoading(true)
    setManualError(null)
    const fd = new FormData(e.currentTarget)
    const result = await createAirport(fd)
    setManualLoading(false)
    if (result?.error) {
      setManualError(result.error)
    } else {
      toast.success('Airport created')
      onOpenChange(false)
      onImported()
    }
  }

  const info = inquiryData?.basicInfo

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Airport</DialogTitle>
          <DialogDescription>
            {step === 'search' && 'Search by IATA or ICAO code to auto-populate from global database'}
            {step === 'preview' && info && `Found: ${info.name}`}
            {step === 'manual' && 'Create a new airport manually'}
          </DialogDescription>
        </DialogHeader>

        {/* ─── STEP 1: SEARCH ─── */}
        {step === 'search' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase())
                    setExistingMatch(null)
                    setInquiryData(null)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                  placeholder="Enter IATA (3 letters) or ICAO (4 letters)..."
                  className="pl-9 font-mono uppercase"
                  maxLength={4}
                />
              </div>
              <Button onClick={handleSearch} disabled={searching || code.trim().length < 3}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </div>

            {/* Existing airport match */}
            {existingMatch && (
              <div className="glass rounded-xl p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {existingMatch.iata_code || existingMatch.icao_code} already exists in your database
                  </p>
                  <p className="text-xs text-muted-foreground">{existingMatch.name} — {existingMatch.city}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 shrink-0">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Exists
                </Badge>
              </div>
            )}

            {/* Not found in OurAirports */}
            {inquiryData && !inquiryData.found && !existingMatch && (
              <div className="glass rounded-xl p-6 text-center space-y-3">
                <AlertTriangle className="h-10 w-10 mx-auto text-amber-500 opacity-60" />
                <p className="text-sm text-muted-foreground">
                  {inquiryData.error || `No data found for ${code.toUpperCase()}.`}
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep('manual')}>
                  Create Manually
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 2: PREVIEW ─── */}
        {step === 'preview' && inquiryData?.found && info && (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-4 pr-1">
            {/* Basic info preview */}
            <div className="glass rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold">Airport Info</h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div>
                  <span className="text-muted-foreground">ICAO</span>
                  <p className="font-mono font-bold">{info.icao_code || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">IATA</span>
                  <p className="font-mono font-bold">{info.iata_code || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Name</span>
                  <p className="font-medium">{info.name || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">City</span>
                  <p>{info.city || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Country</span>
                  <p>{info.iso_country || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="capitalize">{info.type?.replace(/_/g, ' ') || '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Latitude</span>
                  <p className="font-mono">{info.latitude?.toFixed(6) ?? '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Longitude</span>
                  <p className="font-mono">{info.longitude?.toFixed(6) ?? '—'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Elevation</span>
                  <p className="font-mono">{info.elevation_ft != null ? `${info.elevation_ft} ft` : '—'}</p>
                </div>
              </div>
            </div>

            {/* Runways */}
            {inquiryData.runways.length > 0 && (
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Runways</h4>
                  <Badge variant="secondary" className="text-[10px]">{inquiryData.runways.length}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground">
                        <th className="text-left py-1.5 px-2 font-medium">Identifier</th>
                        <th className="text-left py-1.5 px-2 font-medium">Length (m)</th>
                        <th className="text-left py-1.5 px-2 font-medium">Width (m)</th>
                        <th className="text-left py-1.5 px-2 font-medium">Surface</th>
                        <th className="text-left py-1.5 px-2 font-medium">Lighted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiryData.runways.map((r, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-2 px-2 font-mono font-bold">{r.identifier}</td>
                          <td className="py-2 px-2 font-mono">{r.length_m ?? '—'}</td>
                          <td className="py-2 px-2 font-mono">{r.width_m ?? '—'}</td>
                          <td className="py-2 px-2">{r.surface || '—'}</td>
                          <td className="py-2 px-2">{r.lighting ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Frequencies */}
            {inquiryData.frequencies.length > 0 && (
              <div className="glass rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">Frequencies</h4>
                  <Badge variant="secondary" className="text-[10px]">{inquiryData.frequencies.length}</Badge>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-muted-foreground">
                        <th className="text-left py-1.5 px-2 font-medium">Type</th>
                        <th className="text-left py-1.5 px-2 font-medium">Frequency</th>
                        <th className="text-left py-1.5 px-2 font-medium">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiryData.frequencies.map((f, i) => (
                        <tr key={i} className="border-b border-white/5">
                          <td className="py-2 px-2 font-medium">{f.type}</td>
                          <td className="py-2 px-2 font-mono font-semibold">{f.frequency}</td>
                          <td className="py-2 px-2 text-muted-foreground truncate max-w-[200px]">{f.notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── STEP 3: MANUAL CREATE ─── */}
        {step === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-3" id="manual-airport-form">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">ICAO Code *</label>
                <Input name="icao_code" defaultValue={code.length === 4 ? code : ''} placeholder="RJTT" required maxLength={4} className="font-mono uppercase" onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">IATA Code</label>
                <Input name="iata_code" defaultValue={code.length === 3 ? code : ''} placeholder="HND" maxLength={3} className="font-mono uppercase" onChange={(e) => { e.target.value = e.target.value.toUpperCase() }} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Airport Name *</label>
              <Input name="airport_name" placeholder="Tokyo Haneda Airport" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">City *</label>
                <Input name="city" placeholder="Tokyo" required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Timezone (IANA) *</label>
                <Input name="timezone" placeholder="Asia/Tokyo" required />
              </div>
            </div>
            {manualError && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{manualError}</div>
            )}
          </form>
        )}

        {/* ─── FOOTER ─── */}
        <div className="shrink-0 pt-3 border-t border-white/10">
          <div className="flex justify-between">
            <div>
              {step !== 'search' && (
                <Button variant="ghost" size="sm" onClick={() => setStep('search')}>
                  Back to Search
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {step === 'preview' && (
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Importing...</>
                  ) : (
                    'Import Airport'
                  )}
                </Button>
              )}
              {step === 'manual' && (
                <Button type="submit" form="manual-airport-form" disabled={manualLoading}>
                  {manualLoading ? 'Creating...' : 'Create Airport'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
