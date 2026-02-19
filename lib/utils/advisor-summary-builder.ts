import type { AdvisorInput } from '@/app/actions/ai-advisor'

interface SummaryBuilderInput {
  assignedFlights: {
    id: string
    flightNumber: string
    depStation: string
    arrStation: string
    date: Date
    stdMinutes: number
    staMinutes: number
    blockMinutes: number
    aircraftTypeIcao: string | null
    assignedReg: string | null
    aircraftReg: string | null
  }[]
  overflow: {
    id: string
    flightNumber?: string
    depStation: string
    arrStation: string
    date: Date
    aircraftTypeIcao: string | null
  }[]
  chainBreaks: {
    flightId: string
    prevArr: string
    nextDep: string
  }[]
  registrations: {
    registration: string
    aircraft_types?: { icao_type: string } | null
  }[]
  aircraftTypes: {
    icao_type: string
  }[]
  method: string
  rules?: {
    name: string | null
    scope_type: string
    scope_values: string[]
    action: string
    criteria_type: string
    enforcement: string
  }[]
}

export function buildAdvisorSummary(input: SummaryBuilderInput): AdvisorInput {
  const {
    assignedFlights, overflow, chainBreaks,
    registrations, aircraftTypes, method, rules,
  } = input

  // ── Summary ──
  const usedRegs = new Set<string>()
  for (const f of assignedFlights) {
    if (f.assignedReg) usedRegs.add(f.assignedReg)
  }

  const summary: AdvisorInput['summary'] = {
    totalFlights: assignedFlights.length + overflow.length,
    assignedFlights: assignedFlights.filter(f => f.assignedReg).length,
    overflowFlights: overflow.length,
    totalAircraft: registrations.length,
    aircraftUsed: usedRegs.size,
    method,
    chainBreaks: chainBreaks.length,
  }

  // ── Fleet breakdown ──
  const byType = new Map<string, {
    flights: number
    aircraft: Set<string>
    blockMinutes: number
    overflow: number
    chainBreaks: number
  }>()

  for (const f of assignedFlights) {
    const type = f.aircraftTypeIcao || 'UNKN'
    const entry = byType.get(type) || {
      flights: 0, aircraft: new Set<string>(), blockMinutes: 0, overflow: 0, chainBreaks: 0,
    }
    entry.flights++
    if (f.assignedReg) {
      entry.aircraft.add(f.assignedReg)
      entry.blockMinutes += f.blockMinutes
    }
    byType.set(type, entry)
  }

  for (const f of overflow) {
    const type = f.aircraftTypeIcao || 'UNKN'
    const entry = byType.get(type) || {
      flights: 0, aircraft: new Set<string>(), blockMinutes: 0, overflow: 0, chainBreaks: 0,
    }
    entry.overflow++
    byType.set(type, entry)
  }

  const fleetBreakdown: AdvisorInput['fleetBreakdown'] = Array.from(
    byType.entries()
  ).map(([icaoType, data]) => ({
    icaoType,
    totalFlights: data.flights + data.overflow,
    aircraftCount: data.aircraft.size,
    avgUtilizationHours: data.aircraft.size > 0
      ? Math.round((data.blockMinutes / data.aircraft.size / 60) * 10) / 10
      : 0,
    overflowCount: data.overflow,
    chainBreakCount: data.chainBreaks,
  }))

  // ── Top overflow (max 20) ──
  const topOverflow: AdvisorInput['topOverflow'] = overflow
    .slice(0, 20)
    .map(f => ({
      flightNumber: f.flightNumber || '?',
      route: `${f.depStation}-${f.arrStation}`,
      date: f.date.toISOString().slice(0, 10),
      aircraftType: f.aircraftTypeIcao || 'UNKN',
      reason: 'no_aircraft',
    }))

  // ── Top chain breaks (max 15) ──
  const topChainBreaks: AdvisorInput['topChainBreaks'] = chainBreaks
    .slice(0, 15)
    .map(cb => {
      const flight = assignedFlights.find(f => f.id === cb.flightId)
      return {
        flightNumber: flight?.flightNumber || '?',
        aircraft: flight?.assignedReg || '?',
        prevArrival: cb.prevArr,
        nextDeparture: cb.nextDep,
        gapMinutes: 0,
      }
    })

  // ── Active rules ──
  const activeRules: AdvisorInput['activeRules'] = (rules || []).map(r => ({
    name: r.name || 'Unnamed rule',
    scope: `${r.scope_type}: ${r.scope_values.join(', ') || 'all'}`,
    action: r.action,
    criteria: r.criteria_type,
    enforcement: r.enforcement,
  }))

  // ── Utilization extremes (top 5 + bottom 5) ──
  const regUtilization = new Map<string, { blockMins: number; count: number }>()
  for (const f of assignedFlights) {
    if (!f.assignedReg) continue
    const entry = regUtilization.get(f.assignedReg) || { blockMins: 0, count: 0 }
    entry.blockMins += f.blockMinutes
    entry.count++
    regUtilization.set(f.assignedReg, entry)
  }

  const utilList = Array.from(regUtilization.entries())
    .map(([reg, data]) => {
      const acType = registrations.find(r => r.registration === reg)
        ?.aircraft_types?.icao_type || 'UNKN'
      return {
        registration: reg,
        icaoType: acType,
        blockHours: Math.round((data.blockMins / 60) * 10) / 10,
        flightCount: data.count,
      }
    })
    .sort((a, b) => b.blockHours - a.blockHours)

  const utilizationExtremes = [
    ...utilList.slice(0, 5),
    ...utilList.slice(-5),
  ].filter((v, i, arr) => arr.findIndex(x => x.registration === v.registration) === i)

  return {
    summary,
    fleetBreakdown,
    topOverflow,
    topChainBreaks,
    activeRules,
    utilizationExtremes,
  }
}
