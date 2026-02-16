'use client'

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { MasterDetailLayout } from '@/components/ui/responsive/master-detail-layout'
import { AircraftType } from '@/types/database'
import {
  type CityPairWithAirports,
  type CityPairAirport,
  type BlockHourWithAircraftType,
  updateCityPairField,
  createCityPair,
  deleteCityPair,
  getBlockHoursForPair,
  addBlockHour,
  updateBlockHour,
  deleteBlockHour,
  autoEstimateFlightHours,
  fixCityPairClassification,
} from '@/app/actions/city-pairs'
import { calculateGreatCircleDistance, determineRouteType } from '@/lib/utils/geo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
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
  Plane,
  ArrowLeftRight,
  ChevronRight,
  Info,
  Check,
  X,
  Loader2,
  Copy,
  Zap,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'

const CityPairMap = dynamic(() => import('./city-pair-map'), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl glass h-full flex items-center justify-center">
      <span className="text-sm text-muted-foreground animate-pulse">Loading map...</span>
    </div>
  ),
})

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  cityPairs: CityPairWithAirports[]
  aircraftTypes: AircraftType[]
  airports: CityPairAirport[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatMinutes(min: number | null): string {
  if (min == null) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}

function parseTimeToMinutes(val: string): number | null {
  const parts = val.split(':')
  if (parts.length !== 2) return null
  const h = parseInt(parts[0])
  const m = parseInt(parts[1])
  if (isNaN(h) || isNaN(m)) return null
  return h * 60 + m
}

const ROUTE_TYPE_COLORS: Record<string, string> = {
  domestic: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  regional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  international: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'long-haul': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'ultra-long-haul': 'bg-red-500/20 text-red-400 border-red-500/30',
  unknown: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
}

const ROUTE_TYPE_LABELS: Record<string, string> = {
  domestic: 'Domestic',
  regional: 'Regional',
  international: 'International',
  'long-haul': 'Long-haul',
  'ultra-long-haul': 'Ultra-long-haul',
  unknown: 'Unknown',
}

// ─── Main Component ──────────────────────────────────────────────────────

export function CityPairsMasterDetail({ cityPairs, aircraftTypes, airports }: Props) {
  const router = useRouter()
  const [selectedPair, setSelectedPair] = useState<CityPairWithAirports | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('general')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())
  const [blockHours, setBlockHours] = useState<BlockHourWithAircraftType[]>([])
  const [loadingBlockHours, setLoadingBlockHours] = useState(false)
  const [fixingClassification, setFixingClassification] = useState(false)

  const unknownRouteCount = useMemo(
    () => cityPairs.filter(cp => cp.route_type === 'unknown' || !cp.route_type).length,
    [cityPairs]
  )

  async function handleFixClassification() {
    setFixingClassification(true)
    try {
      const result = await fixCityPairClassification()
      if (result.fixed > 0) {
        toast.success(`Fixed ${result.fixed} city pair${result.fixed > 1 ? 's' : ''}`)
        router.refresh()
      } else {
        toast.info('No misclassified city pairs found')
      }
      if (result.unknown > 0) {
        toast.warning(`${result.unknown} pair${result.unknown > 1 ? 's' : ''} still need manual classification`)
      }
    } catch {
      toast.error('Failed to fix city pair classification')
    }
    setFixingClassification(false)
  }

  // Load block hours when pair changes
  useEffect(() => {
    if (!selectedPair) { setBlockHours([]); return }
    setLoadingBlockHours(true)
    getBlockHoursForPair(selectedPair.id).then(data => {
      setBlockHours(data)
      setLoadingBlockHours(false)
    })
  }, [selectedPair?.id])

  const onFieldUpdated = useCallback(() => router.refresh(), [router])

  // ─── Filter + Group ──────────────────────────────────────────────────

  const filteredPairs = useMemo(() => {
    if (!searchQuery) return cityPairs
    const q = searchQuery.toLowerCase()
    return cityPairs.filter(cp => {
      const a1 = cp.airport1
      const a2 = cp.airport2
      return (
        a1?.iata_code?.toLowerCase().includes(q) ||
        a2?.iata_code?.toLowerCase().includes(q) ||
        a1?.icao_code?.toLowerCase().includes(q) ||
        a2?.icao_code?.toLowerCase().includes(q) ||
        a1?.city?.toLowerCase().includes(q) ||
        a2?.city?.toLowerCase().includes(q) ||
        a1?.name?.toLowerCase().includes(q) ||
        a2?.name?.toLowerCase().includes(q)
      )
    })
  }, [cityPairs, searchQuery])

  const groupedPairs = useMemo(() => {
    const groups = new Map<string, CityPairWithAirports[]>()
    const order = ['domestic', 'regional', 'international', 'long-haul', 'ultra-long-haul']
    for (const rt of order) groups.set(rt, [])
    for (const cp of filteredPairs) {
      const rt = cp.route_type || 'international'
      if (!groups.has(rt)) groups.set(rt, [])
      groups.get(rt)!.push(cp)
    }
    // Remove empty groups
    Array.from(groups.entries()).forEach(([k, v]) => {
      if (v.length === 0) groups.delete(k)
    })
    return groups
  }, [filteredPairs])

  const toggleGroup = useCallback((group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }, [])

  // ─── List rendering ──────────────────────────────────────────────────

  function renderListHeader() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">City Pairs</h2>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs">{cityPairs.length}</Badge>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setAddDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search IATA, city, airport..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {unknownRouteCount > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="text-xs text-amber-800 flex-1">
              {unknownRouteCount} pair{unknownRouteCount > 1 ? 's' : ''} with unknown DOM/INT classification
            </span>
            <Button size="sm" variant="outline" className="h-6 text-xs px-2 shrink-0" onClick={handleFixClassification} disabled={fixingClassification}>
              {fixingClassification ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Auto-fix'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  function renderListBody(renderItem: (item: CityPairWithAirports) => React.ReactNode) {
    return (
      <>
        {Array.from(groupedPairs.entries()).map(([routeType, pairs]) => {
          const isCollapsed = collapsedGroups.has(routeType)
          const label = ROUTE_TYPE_LABELS[routeType] || routeType
          return (
            <div key={routeType}>
              <button
                onClick={() => toggleGroup(routeType)}
                className="w-full flex items-center gap-2 px-2 py-2 mt-1 first:mt-0 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors"
              >
                <ChevronRight
                  className={cn(
                    'h-3 w-3 shrink-0 transition-transform duration-200',
                    !isCollapsed && 'rotate-90'
                  )}
                />
                <span>{label}</span>
                <span className="text-muted-foreground/40">({pairs.length})</span>
                <div className="flex-1 h-px bg-border/50 ml-1" />
              </button>
              <div className={cn('region-collapse', !isCollapsed && 'expanded')}>
                <div className="space-y-0.5">
                  {pairs.map(cp => renderItem(cp))}
                </div>
              </div>
            </div>
          )
        })}
      </>
    )
  }

  function renderListItem(cp: CityPairWithAirports, isSelected: boolean) {
    const iata1 = cp.airport1?.iata_code || cp.airport1?.icao_code || '???'
    const iata2 = cp.airport2?.iata_code || cp.airport2?.icao_code || '???'
    const dist = cp.great_circle_distance_nm

    return (
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn(
            'font-mono text-[11px] font-bold',
            isSelected ? 'text-primary' : 'text-muted-foreground'
          )}>{iata1}</span>
          <ArrowLeftRight className="h-2.5 w-2.5 text-muted-foreground" />
          <span className={cn(
            'font-mono text-[11px] font-bold',
            isSelected ? 'text-primary' : 'text-muted-foreground'
          )}>{iata2}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{cp.airport1?.city || ''} — {cp.airport2?.city || ''}</div>
          {dist && <div className="text-[10px] text-muted-foreground tabular-nums">{Math.round(dist)} NM</div>}
        </div>
      </div>
    )
  }

  function renderCompactListItem(cp: CityPairWithAirports, isSelected: boolean) {
    const iata1 = cp.airport1?.iata_code || '?'
    const iata2 = cp.airport2?.iata_code || '?'
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-mono text-[10px] font-bold">{iata1}</span>
        <ArrowLeftRight className="h-2.5 w-2.5 text-muted-foreground" />
        <span className="font-mono text-[10px] font-bold">{iata2}</span>
      </div>
    )
  }

  // ─── Detail rendering ────────────────────────────────────────────────

  function renderDetail(cp: CityPairWithAirports) {
    const iata1 = cp.airport1?.iata_code || cp.airport1?.icao_code || '???'
    const iata2 = cp.airport2?.iata_code || cp.airport2?.icao_code || '???'
    const name1 = cp.airport1?.name?.replace(/International Airport|Airport/gi, '').trim() || ''
    const name2 = cp.airport2?.name?.replace(/International Airport|Airport/gi, '').trim() || ''
    const dist = cp.great_circle_distance_nm
    const hasCoords = cp.airport1?.latitude != null && cp.airport2?.latitude != null

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="shrink-0 mb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold">
              <span className="font-mono tracking-tight">{iata1}</span>
              <span className="text-muted-foreground mx-1">↔</span>
              <span className="font-mono tracking-tight">{iata2}</span>
            </h2>
            <Badge variant="outline" className={cn('text-xs border', ROUTE_TYPE_COLORS[cp.route_type])}>
              {ROUTE_TYPE_LABELS[cp.route_type] || cp.route_type}
            </Badge>
            {dist && (
              <span className="text-sm text-muted-foreground tabular-nums">{Math.round(dist)} NM</span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">{name1} — {name2}</p>
        </div>

        {/* Map */}
        {hasCoords && (
          <div className="shrink-0 mb-3" style={{ height: '48%', minHeight: '200px' }}>
            <CityPairMap
              lat1={cp.airport1!.latitude!}
              lon1={cp.airport1!.longitude!}
              lat2={cp.airport2!.latitude!}
              lon2={cp.airport2!.longitude!}
              iata1={iata1}
              iata2={iata2}
              name1={cp.airport1!.name}
              name2={cp.airport2!.name}
              distanceNm={dist}
              country1Flag={cp.airport1!.countries?.iso_code_2}
              country2Flag={cp.airport2!.countries?.iso_code_2}
              country1Name={cp.airport1!.countries?.name}
              country2Name={cp.airport2!.countries?.name}
              className="h-full"
            />
          </div>
        )}

        {/* Tabs */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="glass shrink-0 justify-start">
              <TabsTrigger value="general" className="text-xs">
                <span className="flex items-center gap-1.5"><Info className="h-3.5 w-3.5" /> General</span>
              </TabsTrigger>
              <TabsTrigger value="block-hours" className="text-xs">Block Hours</TabsTrigger>
              <TabsTrigger value="flight-hours" className="text-xs">Flight Hours</TabsTrigger>
              <TabsTrigger value="fuel" className="text-xs">Fuel</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
              <GeneralTab pair={cp} onFieldUpdated={onFieldUpdated} />
            </TabsContent>
            <TabsContent value="block-hours" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
              <BlockHoursTab
                pair={cp}
                blockHours={blockHours}
                aircraftTypes={aircraftTypes}
                loading={loadingBlockHours}
                onRefresh={() => getBlockHoursForPair(cp.id).then(setBlockHours)}
                mode="block"
              />
            </TabsContent>
            <TabsContent value="flight-hours" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
              <BlockHoursTab
                pair={cp}
                blockHours={blockHours}
                aircraftTypes={aircraftTypes}
                loading={loadingBlockHours}
                onRefresh={() => getBlockHoursForPair(cp.id).then(setBlockHours)}
                mode="flight"
              />
            </TabsContent>
            <TabsContent value="fuel" className="flex-1 min-h-0 overflow-y-auto custom-scrollbar mt-2">
              <BlockHoursTab
                pair={cp}
                blockHours={blockHours}
                aircraftTypes={aircraftTypes}
                loading={loadingBlockHours}
                onRefresh={() => getBlockHoursForPair(cp.id).then(setBlockHours)}
                mode="fuel"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  function renderEmptyDetail() {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
        <Plane className="h-12 w-12 opacity-20" />
        <p className="text-sm">Select a city pair to view details</p>
      </div>
    )
  }

  // ─── Layout ──────────────────────────────────────────────────────────

  return (
    <>
      <MasterDetailLayout
        items={filteredPairs}
        selectedItem={selectedPair}
        onSelectItem={setSelectedPair}
        keyExtractor={(cp) => cp.id}
        renderListItem={renderListItem}
        renderCompactListItem={renderCompactListItem}
        renderDetail={renderDetail}
        renderEmptyDetail={renderEmptyDetail}
        renderListHeader={renderListHeader}
        renderListBody={renderListBody}
        listWidth="narrow"
        className="h-full"
      />

      <AddCityPairDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        airports={airports}
        onCreated={(id) => {
          setAddDialogOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}

// ─── General Tab ─────────────────────────────────────────────────────────

function GeneralTab({ pair, onFieldUpdated }: { pair: CityPairWithAirports; onFieldUpdated: () => void }) {
  const iata1 = pair.airport1?.iata_code || pair.airport1?.icao_code || '???'
  const iata2 = pair.airport2?.iata_code || pair.airport2?.icao_code || '???'
  const dist = pair.great_circle_distance_nm

  return (
    <div className="glass rounded-xl p-4 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Station 1 */}
        <div>
          <label className="text-xs text-muted-foreground">Station 1</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm font-bold">{iata1}</span>
            <span className="text-sm text-muted-foreground truncate">{pair.airport1?.name}</span>
          </div>
        </div>
        {/* Station 2 */}
        <div>
          <label className="text-xs text-muted-foreground">Station 2</label>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-sm font-bold">{iata2}</span>
            <span className="text-sm text-muted-foreground truncate">{pair.airport2?.name}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Distance */}
        <InlineFieldNum
          label="Great Circle Distance (NM)"
          value={dist}
          pairId={pair.id}
          field="great_circle_distance_nm"
          onSaved={onFieldUpdated}
        />
        {/* Route Type */}
        <div>
          <label className="text-xs text-muted-foreground">Route Type</label>
          <div className="mt-1">
            <Badge variant="outline" className={cn('text-xs border', ROUTE_TYPE_COLORS[pair.route_type])}>
              {ROUTE_TYPE_LABELS[pair.route_type] || pair.route_type}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* ETOPS */}
        <div>
          <label className="text-xs text-muted-foreground">ETOPS Required</label>
          <div className="mt-1">
            <Switch
              checked={pair.is_etops}
              onCheckedChange={async (checked) => {
                await updateCityPairField(pair.id, 'is_etops', checked)
                onFieldUpdated()
              }}
            />
          </div>
        </div>
        {pair.is_etops && (
          <InlineFieldNum
            label="ETOPS Diversion Time (min)"
            value={pair.etops_diversion_time_minutes}
            pairId={pair.id}
            field="etops_diversion_time_minutes"
            onSaved={onFieldUpdated}
          />
        )}
      </div>

    </div>
  )
}

// ─── Block Hours Tab (shared for block, flight, fuel) ────────────────────

function BlockHoursTab({
  pair,
  blockHours,
  aircraftTypes,
  loading,
  onRefresh,
  mode,
}: {
  pair: CityPairWithAirports
  blockHours: BlockHourWithAircraftType[]
  aircraftTypes: AircraftType[]
  loading: boolean
  onRefresh: () => void
  mode: 'block' | 'flight' | 'fuel'
}) {
  const iata1 = pair.airport1?.iata_code || '???'
  const iata2 = pair.airport2?.iata_code || '???'
  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState({
    aircraft_type_id: '',
    season_type: 'annual',
    month_applicable: null as number | null,
    dir1: '',
    dir2: '',
    notes: '',
  })

  const infoText = mode === 'block'
    ? 'Block hours include taxi time. Different per direction due to prevailing winds. Schedule Builder auto-fills from this data.'
    : mode === 'flight'
    ? 'Flight hours = airborne time (block minus taxi). Used for FDTL calculations and fuel planning.'
    : 'Average fuel burn per direction. Used for cost estimation and fuel uplift planning.'

  const dir1Label = `${iata1}→${iata2}`
  const dir2Label = `${iata2}→${iata1}`

  const getValue1 = (h: BlockHourWithAircraftType) =>
    mode === 'block' ? h.direction1_block_minutes
    : mode === 'flight' ? h.direction1_flight_minutes
    : h.direction1_fuel_kg

  const getValue2 = (h: BlockHourWithAircraftType) =>
    mode === 'block' ? h.direction2_block_minutes
    : mode === 'flight' ? h.direction2_flight_minutes
    : h.direction2_fuel_kg

  const formatVal = (v: number | null) =>
    mode === 'fuel' ? (v != null ? `${v} kg` : '—') : formatMinutes(v)

  // Check if flight hours are missing but block hours exist
  const hasBlockNoFlight = mode === 'flight' && blockHours.some(h =>
    h.direction1_block_minutes > 0 && h.direction1_flight_minutes == null
  )

  async function handleAdd() {
    if (!newRow.aircraft_type_id || !newRow.dir1 || !newRow.dir2) {
      toast.error('Fill in aircraft type and both direction values')
      return
    }

    let d1: number, d2: number
    if (mode === 'fuel') {
      d1 = parseFloat(newRow.dir1)
      d2 = parseFloat(newRow.dir2)
    } else {
      const p1 = parseTimeToMinutes(newRow.dir1)
      const p2 = parseTimeToMinutes(newRow.dir2)
      if (p1 == null || p2 == null) { toast.error('Use HH:MM format'); return }
      d1 = p1; d2 = p2
    }

    const data: any = {
      city_pair_id: pair.id,
      aircraft_type_id: newRow.aircraft_type_id,
      season_type: newRow.season_type,
      month_applicable: newRow.month_applicable,
    }

    if (mode === 'block') {
      data.direction1_block_minutes = d1
      data.direction2_block_minutes = d2
    } else if (mode === 'flight') {
      // Need block minutes too (required NOT NULL)
      const existing = blockHours.find(h =>
        h.aircraft_type_id === newRow.aircraft_type_id && h.season_type === newRow.season_type
      )
      if (existing) {
        await updateBlockHour(existing.id, {
          direction1_flight_minutes: d1,
          direction2_flight_minutes: d2,
        })
        toast.success('Flight hours updated')
        setAddingRow(false)
        setNewRow({ aircraft_type_id: '', season_type: 'annual', month_applicable: null, dir1: '', dir2: '', notes: '' })
        onRefresh()
        return
      }
      data.direction1_block_minutes = d1 + 15
      data.direction2_block_minutes = d2 + 15
      data.direction1_flight_minutes = d1
      data.direction2_flight_minutes = d2
    } else {
      const existing = blockHours.find(h =>
        h.aircraft_type_id === newRow.aircraft_type_id && h.season_type === newRow.season_type
      )
      if (existing) {
        await updateBlockHour(existing.id, {
          direction1_fuel_kg: d1,
          direction2_fuel_kg: d2,
        })
        toast.success('Fuel data updated')
        setAddingRow(false)
        setNewRow({ aircraft_type_id: '', season_type: 'annual', month_applicable: null, dir1: '', dir2: '', notes: '' })
        onRefresh()
        return
      }
      data.direction1_block_minutes = 0
      data.direction2_block_minutes = 0
      data.direction1_fuel_kg = d1
      data.direction2_fuel_kg = d2
    }

    if (newRow.notes) data.notes = newRow.notes

    const result = await addBlockHour(data)
    if (result.error) { toast.error(friendlyError(result.error)); return }
    toast.success('Row added')
    setAddingRow(false)
    setNewRow({ aircraft_type_id: '', season_type: 'annual', month_applicable: null, dir1: '', dir2: '', notes: '' })
    onRefresh()
  }

  async function handleEstimateFlightHours() {
    const result = await autoEstimateFlightHours(pair.id)
    if (result.error) { toast.error(friendlyError(result.error)); return }
    toast.success(`Estimated flight hours for ${result.updated} rows`)
    onRefresh()
  }

  if (loading) {
    return (
      <div className="glass rounded-xl p-8 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-2.5">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>{infoText}</span>
      </div>

      {hasBlockNoFlight && (
        <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg p-2.5">
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span>Estimate from block hours? (Subtract 15 min average taxi)</span>
          <Button size="sm" variant="outline" className="h-6 text-xs ml-auto" onClick={handleEstimateFlightHours}>
            Auto-estimate
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 text-xs text-muted-foreground">
              <th className="text-left py-2 px-2 font-medium">Season</th>
              <th className="text-left py-2 px-2 font-medium">Month</th>
              <th className="text-left py-2 px-2 font-medium">A/C Type</th>
              <th className="text-right py-2 px-2 font-medium">{dir1Label}</th>
              <th className="text-center py-2 px-1 font-medium w-8"></th>
              <th className="text-right py-2 px-2 font-medium">{dir2Label}</th>
              <th className="text-left py-2 px-2 font-medium">Notes</th>
              <th className="py-2 px-1 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {blockHours.map(h => (
              <BlockHourRow
                key={h.id}
                row={h}
                mode={mode}
                onRefresh={onRefresh}
              />
            ))}
            {blockHours.length === 0 && !addingRow && (
              <tr>
                <td colSpan={8} className="text-center py-6 text-muted-foreground text-xs">
                  No data yet. Click "+ Add" to create a record.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add row form */}
      {addingRow ? (
        <div className="border border-border/50 rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="grid grid-cols-5 gap-2">
            <Select value={newRow.season_type} onValueChange={(v) => setNewRow(p => ({ ...p, season_type: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Annual</SelectItem>
                <SelectItem value="summer">Summer</SelectItem>
                <SelectItem value="winter">Winter</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newRow.month_applicable?.toString() || 'all'} onValueChange={(v) => setNewRow(p => ({ ...p, month_applicable: v === 'all' ? null : parseInt(v) }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{i + 1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newRow.aircraft_type_id} onValueChange={(v) => setNewRow(p => ({ ...p, aircraft_type_id: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="A/C" /></SelectTrigger>
              <SelectContent>
                {aircraftTypes.map(ac => (
                  <SelectItem key={ac.id} value={ac.id}>{ac.icao_type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newRow.dir1}
              onChange={(e) => setNewRow(p => ({ ...p, dir1: e.target.value }))}
              placeholder={mode === 'fuel' ? 'kg' : 'HH:MM'}
              className="h-8 text-xs text-right font-mono"
            />
            <Input
              value={newRow.dir2}
              onChange={(e) => setNewRow(p => ({ ...p, dir2: e.target.value }))}
              placeholder={mode === 'fuel' ? 'kg' : 'HH:MM'}
              className="h-8 text-xs text-right font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newRow.notes}
              onChange={(e) => setNewRow(p => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="h-8 text-xs flex-1"
            />
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleAdd}>
              <Check className="h-3 w-3 mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setAddingRow(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="text-xs h-7 glass" onClick={() => setAddingRow(true)}>
          <Plus className="h-3 w-3 mr-1" /> Add {mode === 'block' ? 'Block Hour' : mode === 'flight' ? 'Flight Hour' : 'Fuel'}
        </Button>
      )}
    </div>
  )
}

// ─── Block Hour Row (inline editable) ────────────────────────────────────

function BlockHourRow({
  row,
  mode,
  onRefresh,
}: {
  row: BlockHourWithAircraftType
  mode: 'block' | 'flight' | 'fuel'
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState<'dir1' | 'dir2' | null>(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const val1 = mode === 'block' ? row.direction1_block_minutes
    : mode === 'flight' ? row.direction1_flight_minutes
    : row.direction1_fuel_kg
  const val2 = mode === 'block' ? row.direction2_block_minutes
    : mode === 'flight' ? row.direction2_flight_minutes
    : row.direction2_fuel_kg

  const formatVal = (v: number | null) =>
    mode === 'fuel' ? (v != null ? `${v}` : '—') : formatMinutes(v)

  function startEdit(dir: 'dir1' | 'dir2') {
    const v = dir === 'dir1' ? val1 : val2
    if (mode === 'fuel') setEditVal(v?.toString() || '')
    else setEditVal(formatMinutes(v))
    setEditing(dir)
  }

  async function saveEdit() {
    if (!editing) return
    let numVal: number | null
    if (mode === 'fuel') {
      numVal = parseFloat(editVal)
      if (isNaN(numVal)) { setEditing(null); return }
    } else {
      numVal = parseTimeToMinutes(editVal)
      if (numVal == null) { setEditing(null); return }
    }

    const field = editing === 'dir1'
      ? (mode === 'block' ? 'direction1_block_minutes' : mode === 'flight' ? 'direction1_flight_minutes' : 'direction1_fuel_kg')
      : (mode === 'block' ? 'direction2_block_minutes' : mode === 'flight' ? 'direction2_flight_minutes' : 'direction2_fuel_kg')

    await updateBlockHour(row.id, { [field]: numVal })
    setEditing(null)
    onRefresh()
  }

  async function copyDirection() {
    if (val1 == null) return
    const field = mode === 'block' ? 'direction2_block_minutes'
      : mode === 'flight' ? 'direction2_flight_minutes' : 'direction2_fuel_kg'
    await updateBlockHour(row.id, { [field]: val1 })
    onRefresh()
  }

  async function handleDelete() {
    await deleteBlockHour(row.id)
    toast.success('Row deleted')
    onRefresh()
  }

  const seasonLabel = row.season_type === 'annual' ? 'Annual' : row.season_type === 'summer' ? 'Summer' : 'Winter'
  const monthLabel = row.month_applicable ? row.month_applicable.toString() : 'All'

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20 transition-colors">
      <td className="py-1.5 px-2 text-xs">{seasonLabel}</td>
      <td className="py-1.5 px-2 text-xs tabular-nums">{monthLabel}</td>
      <td className="py-1.5 px-2 text-xs font-mono font-semibold">{row.aircraft_types?.icao_type || '—'}</td>
      <td className="py-1.5 px-2 text-right">
        {editing === 'dir1' ? (
          <Input
            ref={inputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
            className="h-6 text-xs text-right font-mono w-16 inline-block"
          />
        ) : (
          <button onClick={() => startEdit('dir1')} className="font-mono text-xs tabular-nums hover:text-primary transition-colors">
            {formatVal(val1)}
          </button>
        )}
      </td>
      <td className="py-1.5 px-1 text-center">
        <button
          onClick={copyDirection}
          className="text-muted-foreground hover:text-primary transition-colors"
          title="Copy ↔"
        >
          <Copy className="h-3 w-3" />
        </button>
      </td>
      <td className="py-1.5 px-2 text-right">
        {editing === 'dir2' ? (
          <Input
            ref={inputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }}
            className="h-6 text-xs text-right font-mono w-16 inline-block"
          />
        ) : (
          <button onClick={() => startEdit('dir2')} className="font-mono text-xs tabular-nums hover:text-primary transition-colors">
            {formatVal(val2)}
          </button>
        )}
      </td>
      <td className="py-1.5 px-2 text-xs text-muted-foreground truncate max-w-[120px]">{row.notes || ''}</td>
      <td className="py-1.5 px-1">
        <button onClick={handleDelete} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </td>
    </tr>
  )
}

// ─── Inline Field Components ─────────────────────────────────────────────

function InlineFieldNum({
  label, value, pairId, field, onSaved,
}: {
  label: string; value: number | null; pairId: string; field: string; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value?.toString() || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setEditValue(value?.toString() || '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const save = useCallback(async () => {
    const num = editValue ? parseFloat(editValue) : null
    if (num === value) { setEditing(false); return }
    await updateCityPairField(pairId, field, num)
    onSaved()
    setEditing(false)
  }, [pairId, field, editValue, value, onSaved])

  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      {editing ? (
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
          className="h-8 text-sm mt-1 font-mono"
        />
      ) : (
        <div
          className="mt-1 text-sm font-mono cursor-pointer hover:text-primary transition-colors tabular-nums"
          onClick={() => setEditing(true)}
        >
          {value != null ? Math.round(value) : '—'}
        </div>
      )}
    </div>
  )
}

function InlineTextarea({
  value, pairId, field, onSaved,
}: {
  value: string; pairId: string; field: string; onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setEditValue(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])

  const save = useCallback(async () => {
    if (editValue === value) { setEditing(false); return }
    await updateCityPairField(pairId, field, editValue || null)
    onSaved()
    setEditing(false)
  }, [pairId, field, editValue, value, onSaved])

  return editing ? (
    <Textarea
      ref={ref}
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={save}
      className="mt-1 text-sm glass min-h-[60px]"
    />
  ) : (
    <div
      className="mt-1 text-sm cursor-pointer hover:text-primary transition-colors min-h-[40px] text-muted-foreground"
      onClick={() => setEditing(true)}
    >
      {value || 'Click to add notes...'}
    </div>
  )
}

// ─── Add City Pair Dialog ────────────────────────────────────────────────

function AddCityPairDialog({
  open, onOpenChange, airports, onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  airports: CityPairAirport[]
  onCreated: (id: string) => void
}) {
  const [search1, setSearch1] = useState('')
  const [search2, setSearch2] = useState('')
  const [selected1, setSelected1] = useState<CityPairAirport | null>(null)
  const [selected2, setSelected2] = useState<CityPairAirport | null>(null)
  const [creating, setCreating] = useState(false)
  const [focused, setFocused] = useState<1 | 2 | null>(null)

  // Filter airports for each search
  const filtered1 = useMemo(() => {
    if (!search1 || selected1) return []
    const q = search1.toUpperCase()
    return airports.filter(a =>
      a.iata_code?.includes(q) || a.icao_code?.includes(q) || a.name?.toUpperCase().includes(q) || a.city?.toUpperCase().includes(q)
    ).slice(0, 8)
  }, [airports, search1, selected1])

  const filtered2 = useMemo(() => {
    if (!search2 || selected2) return []
    const q = search2.toUpperCase()
    return airports.filter(a =>
      a.iata_code?.includes(q) || a.icao_code?.includes(q) || a.name?.toUpperCase().includes(q) || a.city?.toUpperCase().includes(q)
    ).slice(0, 8)
  }, [airports, search2, selected2])

  // Auto-calculated preview
  const previewDistance = useMemo(() => {
    if (!selected1?.latitude || !selected1?.longitude || !selected2?.latitude || !selected2?.longitude) return null
    return calculateGreatCircleDistance(selected1.latitude, selected1.longitude, selected2.latitude, selected2.longitude)
  }, [selected1, selected2])

  const previewRouteType = useMemo(() => {
    if (!selected1 || !selected2) return null
    return determineRouteType(
      selected1.country_id, selected2.country_id,
      selected1.countries?.region, selected2.countries?.region
    )
  }, [selected1, selected2])

  async function handleCreate() {
    if (!selected1 || !selected2) return
    if (selected1.id === selected2.id) { toast.error('Stations cannot be the same'); return }

    setCreating(true)
    const result = await createCityPair(selected1.id, selected2.id)
    setCreating(false)

    if (result.error) { toast.error(friendlyError(result.error)); return }
    toast.success(`Created ${selected1.iata_code} ↔ ${selected2.iata_code}`)
    // Reset
    setSearch1(''); setSearch2(''); setSelected1(null); setSelected2(null)
    onCreated(result.id!)
  }

  function reset() {
    setSearch1(''); setSearch2(''); setSelected1(null); setSelected2(null); setFocused(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent className="glass-heavy sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add City Pair</DialogTitle>
          <DialogDescription>Select two airports to create a new city pair.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Station 1 */}
          <div className="relative">
            <label className="text-xs text-muted-foreground">Station 1</label>
            {selected1 ? (
              <div className="flex items-center gap-2 mt-1 p-2 rounded-lg border border-border/50 bg-muted/30">
                <span className="font-mono text-sm font-bold">{selected1.iata_code}</span>
                <span className="text-sm text-muted-foreground truncate">{selected1.name}</span>
                <button onClick={() => { setSelected1(null); setSearch1('') }} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <>
                <Input
                  value={search1}
                  onChange={(e) => setSearch1(e.target.value)}
                  onFocus={() => setFocused(1)}
                  placeholder="Search IATA, ICAO, name..."
                  className="mt-1 h-8 text-sm"
                />
                {focused === 1 && filtered1.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 glass rounded-lg border border-border/50 max-h-48 overflow-y-auto shadow-xl">
                    {filtered1.map(a => (
                      <button
                        key={a.id}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2 text-sm"
                        onMouseDown={(e) => { e.preventDefault(); setSelected1(a); setSearch1(a.iata_code || a.icao_code); setFocused(null) }}
                      >
                        <span className="font-mono text-xs font-bold w-8">{a.iata_code || a.icao_code}</span>
                        <span className="truncate text-muted-foreground">{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Station 2 */}
          <div className="relative">
            <label className="text-xs text-muted-foreground">Station 2</label>
            {selected2 ? (
              <div className="flex items-center gap-2 mt-1 p-2 rounded-lg border border-border/50 bg-muted/30">
                <span className="font-mono text-sm font-bold">{selected2.iata_code}</span>
                <span className="text-sm text-muted-foreground truncate">{selected2.name}</span>
                <button onClick={() => { setSelected2(null); setSearch2('') }} className="ml-auto"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <>
                <Input
                  value={search2}
                  onChange={(e) => setSearch2(e.target.value)}
                  onFocus={() => setFocused(2)}
                  placeholder="Search IATA, ICAO, name..."
                  className="mt-1 h-8 text-sm"
                />
                {focused === 2 && filtered2.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 mt-1 glass rounded-lg border border-border/50 max-h-48 overflow-y-auto shadow-xl">
                    {filtered2.map(a => (
                      <button
                        key={a.id}
                        className="w-full text-left px-3 py-1.5 hover:bg-muted/50 flex items-center gap-2 text-sm"
                        onMouseDown={(e) => { e.preventDefault(); setSelected2(a); setSearch2(a.iata_code || a.icao_code); setFocused(null) }}
                      >
                        <span className="font-mono text-xs font-bold w-8">{a.iata_code || a.icao_code}</span>
                        <span className="truncate text-muted-foreground">{a.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Preview */}
          {selected1 && selected2 && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Distance</span>
                <span className="font-mono font-semibold tabular-nums">
                  {previewDistance ? `${Math.round(previewDistance)} NM` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Route Type</span>
                {previewRouteType && (
                  <Badge variant="outline" className={cn('text-xs border', ROUTE_TYPE_COLORS[previewRouteType])}>
                    {ROUTE_TYPE_LABELS[previewRouteType]}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={!selected1 || !selected2 || creating}
            className="w-full"
          >
            {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create City Pair
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
