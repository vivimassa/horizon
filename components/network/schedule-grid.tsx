'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ScheduleSeason, AircraftType, FlightServiceType, FlightNumber } from '@/types/database'
import { getFlightNumbers } from '@/app/actions/flight-numbers'
import { cn } from '@/lib/utils'

const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DOW_NUMS = ['1', '2', '3', '4', '5', '6', '7']

interface ScheduleGridProps {
  seasons: ScheduleSeason[]
  aircraftTypes: AircraftType[]
  flightServiceTypes: FlightServiceType[]
}

export function ScheduleGrid({ seasons, aircraftTypes, flightServiceTypes }: ScheduleGridProps) {
  const router = useRouter()
  const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '')
  const [flights, setFlights] = useState<FlightNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterAcType, setFilterAcType] = useState('')
  const [filterDep, setFilterDep] = useState('')
  const [filterSvcType, setFilterSvcType] = useState('')

  useEffect(() => {
    if (!selectedSeason) return
    setLoading(true)
    getFlightNumbers(selectedSeason).then(data => {
      setFlights(data)
      setLoading(false)
    })
  }, [selectedSeason])

  // ── Lookup maps ──
  const acTypeMap = useMemo(() => {
    const m = new Map<string, AircraftType>()
    aircraftTypes.forEach(t => m.set(t.id, t))
    return m
  }, [aircraftTypes])

  const svcTypeMap = useMemo(() => {
    const m = new Map<string, FlightServiceType>()
    flightServiceTypes.forEach(s => m.set(s.code, s))
    return m
  }, [flightServiceTypes])

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return flights.filter(f => {
      if (search && !f.flight_number.toLowerCase().includes(search.toLowerCase())) return false
      if (filterAcType && f.aircraft_type_id !== filterAcType) return false
      if (filterDep && f.departure_iata !== filterDep) return false
      if (filterSvcType && f.service_type !== filterSvcType) return false
      return true
    })
  }, [flights, search, filterAcType, filterDep, filterSvcType])

  // ── Summary stats ──
  const stats = useMemo(() => {
    const acTypes = new Set(flights.map(f => f.aircraft_type_id).filter(Boolean))
    const routes = new Set(flights.map(f => `${f.departure_iata}-${f.arrival_iata}`))
    const daily = flights.reduce((sum, f) => sum + f.days_of_week.replace(/\./g, '').length, 0)
    return { total: flights.length, daily, acTypes: acTypes.size, routes: routes.size }
  }, [flights])

  // ── Unique departures for filter ──
  const departures = useMemo(
    () => Array.from(new Set(flights.map(f => f.departure_iata).filter((d): d is string => !!d))).sort(),
    [flights],
  )

  function handleCellClick(flightId: string) {
    router.push(`/network/control/schedule-builder?highlight=${flightId}&season=${selectedSeason}`)
  }

  // ── No seasons ──
  if (!seasons.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No schedule seasons found</p>
        <p className="text-sm mt-1">Create a schedule season in Admin &rarr; Network Config first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground border-b pb-3">
        <span>Total flights: <strong className="text-foreground">{stats.total}</strong></span>
        <span>Daily movements: <strong className="text-foreground">~{stats.daily}</strong></span>
        <span>Aircraft types: <strong className="text-foreground">{stats.acTypes}</strong></span>
        <span>Routes: <strong className="text-foreground">{stats.routes}</strong></span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedSeason}
          onChange={e => setSelectedSeason(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          {seasons.map(s => <option key={s.id} value={s.id}>{s.code} &mdash; {s.name}</option>)}
        </select>

        <input
          placeholder="Search flight number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm w-48"
        />

        <select value={filterAcType} onChange={e => setFilterAcType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Aircraft Types</option>
          {aircraftTypes.map(t => <option key={t.id} value={t.id}>{t.icao_type} &mdash; {t.name}</option>)}
        </select>

        <select value={filterDep} onChange={e => setFilterDep(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Departures</option>
          {departures.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <select value={filterSvcType} onChange={e => setFilterSvcType(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">All Service Types</option>
          {flightServiceTypes.map(s => <option key={s.code} value={s.code}>{s.code} &mdash; {s.name}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading schedule...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {flights.length === 0
            ? 'No flights in this season. Build flights in the Schedule Builder.'
            : 'No flights match your filters.'}
        </div>
      ) : (
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium sticky left-0 bg-muted/50 z-10">Flight</th>
                <th className="px-3 py-2 text-left font-medium">Route</th>
                <th className="px-3 py-2 text-left font-medium">A/C</th>
                <th className="px-3 py-2 text-left font-medium">Svc</th>
                {DOW_LABELS.map((label, i) => (
                  <th key={i} className="px-2 py-2 text-center font-medium min-w-[60px]">
                    <span className="text-muted-foreground text-xs">{i + 1}.</span>{label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => {
                const svc = svcTypeMap.get(f.service_type)
                const acType = f.aircraft_type_id ? acTypeMap.get(f.aircraft_type_id) : null
                const borderColor = svc?.color || 'transparent'

                return (
                  <tr key={f.id} className="border-b hover:bg-muted/20 transition-colors"
                    style={{ borderLeftWidth: '3px', borderLeftColor: borderColor }}>
                    <td className="px-3 py-1.5 font-mono font-medium whitespace-nowrap sticky left-0 bg-background z-10">
                      {f.flight_number}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">
                      {f.departure_iata}&rarr;{f.arrival_iata}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {acType?.icao_type || <span className="text-muted-foreground/40">&mdash;</span>}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {svc ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: svc.color || '#6B9DAD' }} />
                          {svc.code}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{f.service_type}</span>
                      )}
                    </td>
                    {DOW_NUMS.map((d, i) => {
                      const operates = f.days_of_week.includes(d)
                      return (
                        <td
                          key={i}
                          className={cn(
                            'px-1 py-1.5 text-center font-mono text-xs transition-colors',
                            operates
                              ? 'cursor-pointer hover:bg-primary/10 font-medium'
                              : 'text-muted-foreground/20',
                          )}
                          style={operates && svc?.color ? { backgroundColor: svc.color + '15' } : undefined}
                          onClick={() => operates && handleCellClick(f.id)}
                          title={operates ? `${f.flight_number} ${DOW_LABELS[i]} STD ${f.std}` : undefined}
                        >
                          {operates ? f.std || '\u2014' : '\u00B7'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
