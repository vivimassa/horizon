/**
 * Virtual tail assignment engine for Gantt chart display.
 * Client-side only — no database writes.
 *
 * Uses a chain-preferring greedy algorithm to place flights onto
 * available aircraft registrations.  The assignment unit is a
 * **route block**: all legs sharing the same routeId + operating date
 * are assigned atomically to the same aircraft.  Standalone flights
 * (no routeId) form single-flight blocks.
 *
 * Full overlap prevention: every new block is tested against ALL
 * existing assignments on an aircraft using absolute timestamps,
 * not just the most recent arrival.
 */

import {
  evaluateRules, evaluateBonus,
  type FlightForEval, type AircraftForEval,
  type RuleViolation, type RejectionReason,
} from './schedule-rule-evaluator'
import type { ScheduleRule } from '@/app/actions/schedule-rules'

// ─── Input types (minimal — adapted to ExpandedFlight) ────────

export interface AssignableFlight {
  /** Unique per date-instance: "flightId_YYYY-MM-DD" */
  id: string
  /** The underlying scheduled_flight ID (same across dates) */
  flightId: string
  depStation: string
  arrStation: string
  /** Minutes from midnight */
  stdMinutes: number
  /** Minutes from midnight (may exceed 1440 for next-day) */
  staMinutes: number
  aircraftTypeIcao: string | null
  date: Date
  /** Route foreign key — flights sharing a routeId form an atomic block */
  routeId: string | null
  /** DB-persisted manual registration — if set, the whole block is pinned */
  aircraftReg: string | null
  /** Departure day offset within route (0 = first leg day, 1 = next day, etc.) */
  dayOffset: number
  serviceType: string
  /** 'DOM' or 'INT' — used for directional TAT resolution */
  routeType: string | null
}

export interface AssignableAircraft {
  registration: string
  icaoType: string
  homeBase: string | null
}

export interface ChainBreak {
  flightId: string
  prevArr: string
  nextDep: string
}

export interface TailAssignmentResult {
  /** Map: flight.id → registration */
  assignments: Map<string, string>
  /** Flights that couldn't be placed on any aircraft */
  overflow: AssignableFlight[]
  /** Recorded chain breaks (station mismatches between blocks) */
  chainBreaks: ChainBreak[]
  /** Rule violations per flight */
  ruleViolations: Map<string, RuleViolation[]>
  /** Why each rejected aircraft was not chosen (for "why not" panel) */
  rejections: Map<string, RejectionReason[]>
  /** Summary stats */
  summary: {
    totalFlights: number
    assigned: number
    overflowed: number
    hardRulesEnforced: number
    softRulesBent: number
    totalPenaltyCost: number
  }
}

// ─── Assignment block ────────────────────────────────────────

interface AssignmentBlock {
  id: string
  flights: AssignableFlight[] // sorted by date + STD
  icaoType: string
  /** If any flight in the block has aircraftReg, pin whole block */
  preAssignedReg: string | null
  /** Absolute start timestamp (ms) — first flight's departure */
  startMs: number
  /** Absolute end timestamp (ms) — last flight's arrival */
  endMs: number
}

// ─── Time window for overlap tracking ─────────────────────────

interface TimeWindow {
  startMs: number
  endMs: number
  depStation: string
  arrStation: string
  depRouteType: string | null
  arrRouteType: string | null
}

// ─── Aircraft state tracker ───────────────────────────────────

interface AircraftState {
  /** All assigned time windows — checked exhaustively for overlaps */
  windows: TimeWindow[]
  /** Minutes from midnight of the latest-ending assignment (for chain logic) */
  lastSTA: number | null
  /** date.getTime() of the latest-ending assignment (for chain logic) */
  lastSTADate: number | null
  /** Arrival station of the latest-ending assignment (for chain logic) */
  lastARR: string | null
  assignedFlights: AssignableFlight[]
}

// ─── Rule stats accumulator (mutable, shared across functions) ──

interface RuleStats {
  hardRulesEnforced: number
  softRulesBent: number
  totalPenaltyCost: number
}

// ─── Directional TAT types & helpers ─────────────────────────

/** Per-aircraft-type TAT data with scheduled + minimum directional values */
export interface AircraftTypeTAT {
  sched_dd: number | null
  sched_di: number | null
  sched_id: number | null
  sched_ii: number | null
  min_dd: number | null
  min_di: number | null
  min_id: number | null
  min_ii: number | null
  /** Fallback flat TAT in minutes (legacy default_tat_minutes) */
  default: number
}

/** True when the flight's route type is domestic (handles 'DOM', 'domestic', etc.) */
export function isFlightDomestic(routeType: string | null): boolean {
  if (!routeType) return true // assume domestic if unknown
  const rt = routeType.toLowerCase()
  return rt === 'dom' || rt === 'domestic'
}

/**
 * Resolve the correct TAT in milliseconds for a transition between
 * an arriving flight and a departing flight, given their route types.
 *
 * Resolution order:
 *   1. If useMinimum → try minimum directional value
 *   2. Fallback to scheduled directional value
 *   3. Fallback to flat default
 */
export function resolveTatMs(
  tat: AircraftTypeTAT,
  arrivingDomestic: boolean,
  departingDomestic: boolean,
  useMinimum: boolean = false
): number {
  let minutes: number | null = null

  if (useMinimum) {
    if (arrivingDomestic && departingDomestic) minutes = tat.min_dd
    else if (arrivingDomestic && !departingDomestic) minutes = tat.min_di
    else if (!arrivingDomestic && departingDomestic) minutes = tat.min_id
    else minutes = tat.min_ii
  }

  // Fallback to scheduled if minimum is null or not requested
  if (minutes == null) {
    if (arrivingDomestic && departingDomestic) minutes = tat.sched_dd
    else if (arrivingDomestic && !departingDomestic) minutes = tat.sched_di
    else if (!arrivingDomestic && departingDomestic) minutes = tat.sched_id
    else minutes = tat.sched_ii
  }

  // Final fallback to flat default
  if (minutes == null) minutes = tat.default

  return minutes * 60000
}

// ─── Helpers ──────────────────────────────────────────────────

/** Convert date + minutes-from-midnight to absolute milliseconds. */
function toAbsoluteMs(date: Date, minutes: number): number {
  return date.getTime() + minutes * 60000
}

/**
 * Check if a block can fit on an aircraft without overlapping
 * any existing assignment (including TAT buffer).
 *
 * Two intervals conflict if:
 *   blockStart < existEnd + TAT  AND  existStart < blockEnd + TAT
 */
function canFitBlock(
  state: AircraftState,
  blockStartMs: number,
  blockEndMs: number,
  blockDepRouteType: string | null,
  blockArrRouteType: string | null,
  tatData: AircraftTypeTAT,
  useMinimum: boolean
): boolean {
  for (const w of state.windows) {
    // TAT needed after existing window → before new block
    const tatAfterExisting = resolveTatMs(
      tatData,
      isFlightDomestic(w.arrRouteType),
      isFlightDomestic(blockDepRouteType),
      useMinimum
    )
    // TAT needed after new block → before existing window
    const tatAfterBlock = resolveTatMs(
      tatData,
      isFlightDomestic(blockArrRouteType),
      isFlightDomestic(w.depRouteType),
      useMinimum
    )

    if (blockStartMs < w.endMs + tatAfterExisting && w.startMs < blockEndMs + tatAfterBlock) {
      return false
    }
  }
  return true
}

/**
 * Check station chain compatibility: does placing this block break
 * the station chain with the flights immediately before/after it?
 *
 * Returns true if the block fits the chain (or there is no neighbour).
 */
function checkStationChain(
  state: AircraftState,
  block: AssignmentBlock,
): boolean {
  const blockDepStation = block.flights[0].depStation
  const blockArrStation = block.flights[block.flights.length - 1].arrStation

  // Find the flight window that ends closest BEFORE this block starts
  let prevWindow: TimeWindow | null = null
  let prevEndMs = -Infinity
  for (const w of state.windows) {
    if (w.endMs <= block.startMs && w.endMs > prevEndMs) {
      prevWindow = w
      prevEndMs = w.endMs
    }
  }

  // Find the flight window that starts closest AFTER this block ends
  let nextWindow: TimeWindow | null = null
  let nextStartMs = Infinity
  for (const w of state.windows) {
    if (w.startMs >= block.endMs && w.startMs < nextStartMs) {
      nextWindow = w
      nextStartMs = w.startMs
    }
  }

  // Check backward chain: previous arrival must match block departure
  if (prevWindow && prevWindow.arrStation !== blockDepStation) {
    return false
  }

  // Check forward chain: block arrival must match next departure
  if (nextWindow && blockArrStation !== nextWindow.depStation) {
    return false
  }

  // Home base is a preference, not a hard constraint
  // (returning false here would block first assignment entirely
  //  if aircraft home base differs from first flight departure)
  // We leave this as "true" — the caller uses chainOk for scoring

  return true
}

/**
 * Validate that legs within a route block don't overlap each other.
 * Returns false (+ console.warn) if there's an internal data issue.
 */
function validateBlockInternal(block: AssignmentBlock): boolean {
  for (let i = 0; i < block.flights.length - 1; i++) {
    const curr = block.flights[i]
    const next = block.flights[i + 1]
    const currEndMs = toAbsoluteMs(curr.date, curr.staMinutes)
    const nextStartMs = toAbsoluteMs(next.date, next.stdMinutes)
    if (nextStartMs < currEndMs) {
      console.warn(
        `Route ${block.id}: internal leg overlap — leg ends at ${curr.staMinutes}min but next starts at ${next.stdMinutes}min`
      )
      return false
    }
  }
  return true
}

// ─── Block builder ───────────────────────────────────────────

function buildBlocks(flights: AssignableFlight[]): AssignmentBlock[] {
  // Group flights: same routeId + same operating cycle base date → one block.
  // For multi-day routes, dayOffset tells us which day of the route this leg
  // operates on: base date = flight date − dayOffset days.
  // null routeId → standalone single-flight block.
  const blockMap = new Map<string, AssignableFlight[]>()

  for (const f of flights) {
    let key: string
    if (f.routeId) {
      // Compute the operating cycle's base date by subtracting dayOffset
      const baseDateMs = f.date.getTime() - f.dayOffset * 86400000
      const baseDate = new Date(baseDateMs).toISOString().slice(0, 10)
      key = `route_${f.routeId}_${baseDate}`
    } else {
      key = `standalone_${f.id}`
    }
    const list = blockMap.get(key) || []
    list.push(f)
    blockMap.set(key, list)
  }

  const blocks: AssignmentBlock[] = []
  Array.from(blockMap.entries()).forEach(([id, blockFlights]) => {
    // Sort flights within block chronologically
    blockFlights.sort((a: AssignableFlight, b: AssignableFlight) => {
      const da = a.date.getTime()
      const db = b.date.getTime()
      if (da !== db) return da - db
      return a.stdMinutes - b.stdMinutes
    })

    const first = blockFlights[0]
    const last = blockFlights[blockFlights.length - 1]

    blocks.push({
      id,
      flights: blockFlights,
      icaoType: blockFlights[0].aircraftTypeIcao || 'UNKN',
      preAssignedReg: blockFlights.find((f: AssignableFlight) => f.aircraftReg)?.aircraftReg || null,
      startMs: toAbsoluteMs(first.date, first.stdMinutes),
      endMs: toAbsoluteMs(last.date, last.staMinutes),
    })
  })

  return blocks
}

// ─── Main function ────────────────────────────────────────────

/**
 * Auto-assign flights to aircraft registrations for display.
 * Flights sharing a routeId are treated as an atomic block —
 * all legs go to the same aircraft or all overflow together.
 *
 * @param flights - All expanded (date-instanced) flights in the current view
 * @param aircraft - All aircraft registrations (with type + home base)
 * @param tatByType - Directional TAT data per AC type (ICAO → AircraftTypeTAT)
 * @param useMinimumTat - If true, use minimum TAT values (SA mode); false = scheduled (Greedy/MIP)
 * @returns Assignment mapping, overflow list, and chain break info
 */
export function autoAssignFlights(
  flights: AssignableFlight[],
  aircraft: AssignableAircraft[],
  tatByType: Map<string, AircraftTypeTAT>,
  method: 'minimize' | 'balance' = 'minimize',
  rules: ScheduleRule[] = [],
  aircraftFamilies: Map<string, string> = new Map(),
  allowFamilySub: boolean = false,
  typeFamilyMap: Map<string, string> = new Map(),
  useMinimumTat: boolean = false
): TailAssignmentResult {
  const assignments = new Map<string, string>()
  const overflow: AssignableFlight[] = []
  const chainBreaks: ChainBreak[] = []
  const ruleViolations = new Map<string, RuleViolation[]>()
  const rejections = new Map<string, RejectionReason[]>()
  const stats = { hardRulesEnforced: 0, softRulesBent: 0, totalPenaltyCost: 0 }

  // Build atomic blocks from flights
  const allBlocks = buildBlocks(flights)

  // Group blocks by AC type
  const blocksByType = new Map<string, AssignmentBlock[]>()
  for (const block of allBlocks) {
    const list = blocksByType.get(block.icaoType) || []
    list.push(block)
    blocksByType.set(block.icaoType, list)
  }

  // Group aircraft by ICAO type
  const aircraftByType = new Map<string, AssignableAircraft[]>()
  for (const ac of aircraft) {
    const list = aircraftByType.get(ac.icaoType) || []
    list.push(ac)
    aircraftByType.set(ac.icaoType, list)
  }

  // Initialize global aircraft states (shared across all type groups for family sub)
  const globalStates = new Map<string, AircraftState>()
  for (const ac of aircraft) {
    globalStates.set(ac.registration, {
      windows: [],
      lastSTA: null,
      lastSTADate: null,
      lastARR: null,           // Aircraft starts "anywhere"
      assignedFlights: [],
    })
  }

  // Helper: record a block's assignment on an aircraft state
  const recordAssignment = (block: AssignmentBlock, reg: string) => {
    for (const f of block.flights) {
      assignments.set(f.id, reg)
    }
    const st = globalStates.get(reg)
    if (st) {
      const firstFl = block.flights[0]
      const lastFlight = block.flights[block.flights.length - 1]
      st.windows.push({
        startMs: block.startMs,
        endMs: block.endMs,
        depStation: firstFl.depStation,
        arrStation: lastFlight.arrStation,
        depRouteType: firstFl.routeType,
        arrRouteType: lastFlight.routeType,
      })
      const currentLastEndMs = st.lastSTA !== null && st.lastSTADate !== null
        ? st.lastSTADate + st.lastSTA * 60000
        : -Infinity
      if (block.endMs > currentLastEndMs) {
        st.lastSTA = lastFlight.staMinutes
        st.lastSTADate = lastFlight.date.getTime()
        st.lastARR = lastFlight.arrStation
      }
      st.assignedFlights.push(...block.flights)
    }
  }

  // Process each type group
  Array.from(blocksByType.entries()).forEach(([icaoType, typeBlocks]) => {
    const regs = aircraftByType.get(icaoType)
    if (!regs || regs.length === 0) {
      // No aircraft of this type — all blocks overflow
      for (const block of typeBlocks) overflow.push(...block.flights)
      return
    }

    const tatData = tatByType.get(icaoType) ?? { sched_dd: null, sched_di: null, sched_id: null, sched_ii: null, min_dd: null, min_di: null, min_id: null, min_ii: null, default: 30 }

    // Use global states (shared across type groups for family substitution)
    const states = globalStates

    // ── Step 1: Separate DB-assigned (pinned) blocks from unassigned ──
    const pinnedBlocks: AssignmentBlock[] = []
    const freeBlocks: AssignmentBlock[] = []
    for (const block of typeBlocks) {
      if (block.preAssignedReg) {
        pinnedBlocks.push(block)
      } else {
        freeBlocks.push(block)
      }
    }

    // ── Step 2: Process pinned blocks FIRST — they are immovable ──
    // DB-assigned flights ALWAYS go on their assigned aircraft row.
    // Record their time windows so auto-assignment works AROUND them.
    pinnedBlocks.sort((a: AssignmentBlock, b: AssignmentBlock) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      return a.endMs - b.endMs
    })

    for (const block of pinnedBlocks) {
      const reg = block.preAssignedReg!
      const st = states.get(reg)

      // Record chain break BEFORE updating state
      if (st && st.lastARR && st.lastARR !== block.flights[0].depStation) {
        chainBreaks.push({
          flightId: block.flights[0].id,
          prevArr: st.lastARR,
          nextDep: block.flights[0].depStation,
        })
      }

      // Force-assign: DB assignments are absolute truth, never overflow
      recordAssignment(block, reg)

      // Report-only evaluation for pinned flights (don't block, just record)
      if (rules.length > 0) {
        const acForEval: AircraftForEval = {
          registration: reg,
          icaoType: icaoType,
          family: aircraftFamilies.get(reg) || null,
        }
        for (const f of block.flights) {
          const fEval: FlightForEval = {
            id: f.id,
            depStation: f.depStation,
            arrStation: f.arrStation,
            stdMinutes: f.stdMinutes,
            staMinutes: f.staMinutes,
            blockMinutes: f.staMinutes - f.stdMinutes,
            serviceType: f.serviceType || 'J',
            date: f.date,
            aircraftTypeIcao: f.aircraftTypeIcao,
          }
          const result = evaluateRules(fEval, acForEval, rules)
          if (result.violations.length > 0) {
            const existing = ruleViolations.get(f.id) || []
            ruleViolations.set(f.id, [...existing, ...result.violations])
            stats.softRulesBent += result.violations.filter(v => v.enforcement === 'soft').length
            stats.hardRulesEnforced += result.violations.filter(v => v.enforcement === 'hard').length
            stats.totalPenaltyCost += result.totalPenalty
          }
        }
      }
    }

    // ── Step 3: Auto-assign remaining blocks around pinned flights ──
    freeBlocks.sort((a: AssignmentBlock, b: AssignmentBlock) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      return a.endMs - b.endMs
    })

    for (const block of freeBlocks) {
      // Validate internal consistency of multi-leg route blocks
      if (block.flights.length > 1 && !validateBlockInternal(block)) {
        overflow.push(...block.flights)
        continue
      }

      const firstFlight = block.flights[0]
      let bestReg: string | null

      if (method === 'balance') {
        bestReg = findBalancedAircraft(
          firstFlight, block, states, regs, tatData, useMinimumTat, chainBreaks,
          rules, aircraftFamilies, ruleViolations, rejections, stats
        )
      } else {
        bestReg = findBestAircraft(
          firstFlight, block,
          states, regs, tatData, useMinimumTat, chainBreaks,
          rules, aircraftFamilies, ruleViolations, rejections, stats
        )
      }

      if (bestReg) {
        recordAssignment(block, bestReg)
      } else {
        // Entire block overflows together
        overflow.push(...block.flights)
      }
    }
  })

  // ── Family substitution pass ──────────────────────────────
  // If enabled, try to place overflow blocks on aircraft of a
  // different type but same family.
  if (allowFamilySub && overflow.length > 0) {
    const overflowBlocks = buildBlocks(overflow)

    // Build family → aircraft types map
    const familyToTypes = new Map<string, string[]>()
    for (const [icao, family] of Array.from(typeFamilyMap.entries())) {
      const list = familyToTypes.get(family) || []
      if (!list.includes(icao)) list.push(icao)
      familyToTypes.set(family, list)
    }

    // Clear overflow — we'll re-add flights that still can't be placed
    overflow.length = 0

    for (const block of overflowBlocks) {
      const blockFamily = typeFamilyMap.get(block.icaoType)
      if (!blockFamily) {
        overflow.push(...block.flights)
        continue
      }

      // Find sibling types in the same family (excluding the original type)
      const siblingTypes = (familyToTypes.get(blockFamily) || [])
        .filter(t => t !== block.icaoType)

      if (siblingTypes.length === 0) {
        overflow.push(...block.flights)
        continue
      }

      // Collect all aircraft of sibling types
      const siblingRegs: AssignableAircraft[] = []
      for (const sibType of siblingTypes) {
        const regs = aircraftByType.get(sibType)
        if (regs) siblingRegs.push(...regs)
      }

      if (siblingRegs.length === 0) {
        overflow.push(...block.flights)
        continue
      }

      // Use TAT data from the first available sibling type (or fallback)
      let sibTatData: AircraftTypeTAT = { sched_dd: null, sched_di: null, sched_id: null, sched_ii: null, min_dd: null, min_di: null, min_id: null, min_ii: null, default: 30 }
      for (const sibType of siblingTypes) {
        const td = tatByType.get(sibType)
        if (td) { sibTatData = td; break }
      }

      const firstFlight = block.flights[0]
      let bestReg: string | null

      if (method === 'balance') {
        bestReg = findBalancedAircraft(
          firstFlight, block, globalStates, siblingRegs, sibTatData, useMinimumTat, chainBreaks,
          rules, aircraftFamilies, ruleViolations, rejections, stats
        )
      } else {
        bestReg = findBestAircraft(
          firstFlight, block, globalStates, siblingRegs, sibTatData, useMinimumTat, chainBreaks,
          rules, aircraftFamilies, ruleViolations, rejections, stats
        )
      }

      if (bestReg) {
        recordAssignment(block, bestReg)
      } else {
        overflow.push(...block.flights)
      }
    }
  }

  return {
    assignments, overflow, chainBreaks, ruleViolations, rejections,
    summary: {
      totalFlights: flights.length,
      assigned: assignments.size,
      overflowed: overflow.length,
      hardRulesEnforced: stats.hardRulesEnforced,
      softRulesBent: stats.softRulesBent,
      totalPenaltyCost: stats.totalPenaltyCost,
    },
  }
}

// ─── Priority-based aircraft selection ────────────────────────

function findBestAircraft(
  firstFlight: AssignableFlight,
  block: AssignmentBlock,
  states: Map<string, AircraftState>,
  regs: AssignableAircraft[],
  tatData: AircraftTypeTAT,
  useMinimum: boolean,
  chainBreaks: ChainBreak[],
  rules: ScheduleRule[],
  aircraftFamilies: Map<string, string>,
  ruleViolations: Map<string, RuleViolation[]>,
  rejections: Map<string, RejectionReason[]>,
  stats: RuleStats
): string | null {
  interface Candidate {
    reg: string
    priority: 1 | 2 | 3
    gap: number
    softPenalty: number
    violations: RuleViolation[]
    bonus: number
  }

  const candidates: Candidate[] = []
  const firstFlightDateMs = firstFlight.date.getTime()

  for (const ac of regs) {
    const st = states.get(ac.registration)!

    const blockDepRouteType = block.flights[0].routeType
    const blockArrRouteType = block.flights[block.flights.length - 1].routeType

    // Full overlap check against ALL existing assignments
    if (!canFitBlock(st, block.startMs, block.endMs, blockDepRouteType, blockArrRouteType, tatData, useMinimum)) {
      for (const f of block.flights) {
        const flightRejections = rejections.get(f.id) || []
        flightRejections.push({
          registration: ac.registration,
          icaoType: ac.icaoType,
          reason: 'overlap',
        })
        rejections.set(f.id, flightRejections)
      }
      continue
    }

    // Station chain — used for priority scoring, NOT hard filter
    const chainOk = checkStationChain(st, block)

    // ── Rule evaluation ──
    const acForEval: AircraftForEval = {
      registration: ac.registration,
      icaoType: ac.icaoType,
      family: aircraftFamilies.get(ac.registration) || null,
    }

    let hardBlocked = false
    let blockSoftPenalty = 0
    let blockBonus = 0
    const blockViolations: RuleViolation[] = []

    if (rules.length > 0) {
      for (const f of block.flights) {
        const fEval: FlightForEval = {
          id: f.id,
          depStation: f.depStation,
          arrStation: f.arrStation,
          stdMinutes: f.stdMinutes,
          staMinutes: f.staMinutes,
          blockMinutes: f.staMinutes - f.stdMinutes,
          serviceType: f.serviceType || 'J',
          date: f.date,
          aircraftTypeIcao: f.aircraftTypeIcao,
        }

        const result = evaluateRules(fEval, acForEval, rules)
        if (!result.allowed) {
          hardBlocked = true
          for (const fl of block.flights) {
            const flightRejections = rejections.get(fl.id) || []
            flightRejections.push({
              registration: ac.registration,
              icaoType: ac.icaoType,
              reason: 'hard_rule',
              ruleViolations: result.violations,
            })
            rejections.set(fl.id, flightRejections)
          }
          break
        }
        blockSoftPenalty += result.totalPenalty
        blockViolations.push(...result.violations)
        blockBonus += evaluateBonus(fEval, acForEval, rules)
      }
    }

    if (hardBlocked) continue

    const sameStation = st.lastARR === firstFlight.depStation
    const isIdle = st.lastSTA === null

    let priority: 1 | 2 | 3
    let gap: number

    if (chainOk && sameStation && !isIdle) {
      // Perfect chain continuation
      priority = 1
      gap = computeGap(st, firstFlight, firstFlightDateMs)
    } else if (chainOk && isIdle) {
      // Idle aircraft, chain compatible
      priority = 2
      gap = Infinity
    } else {
      // Available but station mismatch — still usable
      priority = 3
      gap = Infinity
    }

    candidates.push({
      reg: ac.registration,
      priority,
      gap,
      softPenalty: blockSoftPenalty,
      violations: blockViolations,
      bonus: blockBonus,
    })
  }

  if (candidates.length === 0) return null

  // Sort: priority ASC, then net cost ASC (softPenalty - bonus), then gap ASC
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    const aCost = a.softPenalty - a.bonus
    const bCost = b.softPenalty - b.bonus
    if (aCost !== bCost) return aCost - bCost
    return a.gap - b.gap
  })

  const best = candidates[0]

  // Record chain break if station mismatch (between blocks)
  if (best.priority === 3) {
    const st = states.get(best.reg)!
    if (st.lastARR && st.lastARR !== firstFlight.depStation) {
      chainBreaks.push({
        flightId: firstFlight.id,
        prevArr: st.lastARR,
        nextDep: firstFlight.depStation,
      })
    }
  }

  // Record violations for the winning candidate
  if (best.violations.length > 0) {
    for (const f of block.flights) {
      const existing = ruleViolations.get(f.id) || []
      ruleViolations.set(f.id, [...existing, ...best.violations])
    }
    stats.softRulesBent += best.violations.filter(v => v.enforcement === 'soft').length
    stats.totalPenaltyCost += best.softPenalty
  }

  // Record non-winners as rejected by score
  for (const c of candidates) {
    if (c.reg === best.reg) continue
    for (const f of block.flights) {
      const flightRejections = rejections.get(f.id) || []
      flightRejections.push({
        registration: c.reg,
        icaoType: regs.find(r => r.registration === c.reg)?.icaoType || '',
        reason: 'score',
        totalCost: c.softPenalty - c.bonus,
      })
      rejections.set(f.id, flightRejections)
    }
  }

  return best.reg
}

// ─── Balance-utilization aircraft selection (Good Solution) ──

/**
 * Select the best aircraft using balance-utilization scoring.
 * Primary factor: prefer aircraft with FEWER total block minutes
 * so that hours are distributed evenly across the fleet.
 */
function findBalancedAircraft(
  firstFlight: AssignableFlight,
  block: AssignmentBlock,
  states: Map<string, AircraftState>,
  regs: AssignableAircraft[],
  tatData: AircraftTypeTAT,
  useMinimum: boolean,
  chainBreaks: ChainBreak[],
  rules: ScheduleRule[],
  aircraftFamilies: Map<string, string>,
  ruleViolations: Map<string, RuleViolation[]>,
  rejections: Map<string, RejectionReason[]>,
  stats: RuleStats
): string | null {
  interface Candidate {
    reg: string
    score: number
    violations: RuleViolation[]
    softPenalty: number
  }

  const candidates: Candidate[] = []
  const blockFirstDep = firstFlight.depStation
  const blockDepRouteType = block.flights[0].routeType
  const blockArrRouteType = block.flights[block.flights.length - 1].routeType

  for (const ac of regs) {
    const st = states.get(ac.registration)!

    // Full overlap check against ALL existing assignments
    if (!canFitBlock(st, block.startMs, block.endMs, blockDepRouteType, blockArrRouteType, tatData, useMinimum)) {
      for (const f of block.flights) {
        const flightRejections = rejections.get(f.id) || []
        flightRejections.push({
          registration: ac.registration,
          icaoType: ac.icaoType,
          reason: 'overlap',
        })
        rejections.set(f.id, flightRejections)
      }
      continue
    }

    // Station chain — used for priority scoring, NOT hard filter
    const chainOk = checkStationChain(st, block)

    // ── Rule evaluation ──
    const acForEval: AircraftForEval = {
      registration: ac.registration,
      icaoType: ac.icaoType,
      family: aircraftFamilies.get(ac.registration) || null,
    }

    let hardBlocked = false
    let blockSoftPenalty = 0
    let blockBonus = 0
    const blockViolations: RuleViolation[] = []

    if (rules.length > 0) {
      for (const f of block.flights) {
        const fEval: FlightForEval = {
          id: f.id,
          depStation: f.depStation,
          arrStation: f.arrStation,
          stdMinutes: f.stdMinutes,
          staMinutes: f.staMinutes,
          blockMinutes: f.staMinutes - f.stdMinutes,
          serviceType: f.serviceType || 'J',
          date: f.date,
          aircraftTypeIcao: f.aircraftTypeIcao,
        }

        const result = evaluateRules(fEval, acForEval, rules)
        if (!result.allowed) {
          hardBlocked = true
          for (const fl of block.flights) {
            const flightRejections = rejections.get(fl.id) || []
            flightRejections.push({
              registration: ac.registration,
              icaoType: ac.icaoType,
              reason: 'hard_rule',
              ruleViolations: result.violations,
            })
            rejections.set(fl.id, flightRejections)
          }
          break
        }
        blockSoftPenalty += result.totalPenalty
        blockViolations.push(...result.violations)
        blockBonus += evaluateBonus(fEval, acForEval, rules)
      }
    }

    if (hardBlocked) continue

    let score = 0

    // UTILIZATION SCORE (primary):
    const totalBlockMinutes = st.assignedFlights.reduce((sum, f) => {
      return sum + (toAbsoluteMs(f.date, f.staMinutes) - toAbsoluteMs(f.date, f.stdMinutes)) / 60000
    }, 0)
    score -= totalBlockMinutes * 2

    // CHAIN BONUS / PENALTY:
    if (chainOk && st.lastARR && st.lastARR === blockFirstDep && st.lastSTA !== null) {
      score += 500     // perfect chain — big bonus
    } else if (!chainOk && st.windows.length > 0) {
      score -= 200     // chain break — penalty but don't skip
    }

    // EMPTY AIRCRAFT BONUS:
    if (st.assignedFlights.length === 0) {
      score += 300
    }

    // TIME GAP PENALTY:
    if (st.lastSTA !== null && st.lastSTADate !== null) {
      const lastEndMs = st.lastSTADate + st.lastSTA * 60000
      const gapMinutes = (block.startMs - lastEndMs) / 60000
      if (gapMinutes > 360) {
        score -= 50
      }
    }

    // Apply rule penalty and bonus to score
    score -= blockSoftPenalty
    score += blockBonus

    candidates.push({ reg: ac.registration, score, violations: blockViolations, softPenalty: blockSoftPenalty })
  }

  if (candidates.length === 0) return null

  // Pick the aircraft with highest score
  candidates.sort((a, b) => b.score - a.score)

  const best = candidates[0]

  // Record violations for the winning candidate
  if (best.violations.length > 0) {
    for (const f of block.flights) {
      const existing = ruleViolations.get(f.id) || []
      ruleViolations.set(f.id, [...existing, ...best.violations])
    }
    stats.softRulesBent += best.violations.filter(v => v.enforcement === 'soft').length
    stats.totalPenaltyCost += best.softPenalty
  }

  // Record non-winners as rejected by score
  for (const c of candidates) {
    if (c.reg === best.reg) continue
    for (const f of block.flights) {
      const flightRejections = rejections.get(f.id) || []
      flightRejections.push({
        registration: c.reg,
        icaoType: regs.find(r => r.registration === c.reg)?.icaoType || '',
        reason: 'score',
        totalCost: c.softPenalty,
      })
      rejections.set(f.id, flightRejections)
    }
  }

  return best.reg
}

/** Compute gap minutes between aircraft's latest STA and the flight's STD. */
function computeGap(
  state: AircraftState,
  flight: AssignableFlight,
  flightDateMs: number
): number {
  if (state.lastSTA === null || state.lastSTADate === null) return Infinity

  // Same day
  if (flightDateMs === state.lastSTADate) {
    return flight.stdMinutes - state.lastSTA
  }

  // Different day — gap is (rest of prev day) + (full intervening days * 1440) + flight STD
  const dayDiffMs = flightDateMs - state.lastSTADate
  const dayDiff = Math.round(dayDiffMs / 86400000)
  return (1440 - state.lastSTA) + (dayDiff - 1) * 1440 + flight.stdMinutes
}
