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
  minTatMs: number
): boolean {
  for (const w of state.windows) {
    if (blockStartMs < w.endMs + minTatMs && w.startMs < blockEndMs + minTatMs) {
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

  // If no previous window, check against aircraft's home base / initial position
  if (!prevWindow && state.lastARR !== null && state.windows.length === 0) {
    if (state.lastARR !== blockDepStation) {
      return false
    }
  }

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
 * @param defaultTatMinutes - Default turnaround time per AC type (ICAO → minutes)
 * @returns Assignment mapping, overflow list, and chain break info
 */
export function autoAssignFlights(
  flights: AssignableFlight[],
  aircraft: AssignableAircraft[],
  defaultTatMinutes: Map<string, number>,
  method: 'minimize' | 'balance' = 'minimize'
): TailAssignmentResult {
  const assignments = new Map<string, string>()
  const overflow: AssignableFlight[] = []
  const chainBreaks: ChainBreak[] = []

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

  // Process each type group
  Array.from(blocksByType.entries()).forEach(([icaoType, typeBlocks]) => {
    const regs = aircraftByType.get(icaoType)
    if (!regs || regs.length === 0) {
      // No aircraft of this type — all blocks overflow
      for (const block of typeBlocks) overflow.push(...block.flights)
      return
    }

    const minTat = defaultTatMinutes.get(icaoType) ?? 30
    const minTatMs = minTat * 60000

    // Sort blocks by absolute start time (earliest first)
    typeBlocks.sort((a: AssignmentBlock, b: AssignmentBlock) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs
      return a.endMs - b.endMs
    })

    // Initialize aircraft state
    const states = new Map<string, AircraftState>()
    for (const reg of regs) {
      states.set(reg.registration, {
        windows: [],
        lastSTA: null,
        lastSTADate: null,
        lastARR: reg.homeBase,
        assignedFlights: [],
      })
    }

    // ── Separate pinned and free blocks ──
    const pinnedBlocks: AssignmentBlock[] = []
    const freeBlocks: AssignmentBlock[] = []
    for (const block of typeBlocks) {
      if (block.preAssignedReg) {
        pinnedBlocks.push(block)
      } else {
        freeBlocks.push(block)
      }
    }

    // Helper: record a block's assignment on an aircraft state
    const recordAssignment = (block: AssignmentBlock, reg: string) => {
      for (const f of block.flights) {
        assignments.set(f.id, reg)
      }
      const st = states.get(reg)
      if (st) {
        const firstFl = block.flights[0]
        const lastFlight = block.flights[block.flights.length - 1]
        st.windows.push({
          startMs: block.startMs,
          endMs: block.endMs,
          depStation: firstFl.depStation,
          arrStation: lastFlight.arrStation,
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

    // ── Process pinned blocks FIRST — they are immovable ──
    for (const block of pinnedBlocks) {
      const reg = block.preAssignedReg!
      const st = states.get(reg)

      if (st && st.lastARR && st.lastARR !== block.flights[0].depStation) {
        chainBreaks.push({
          flightId: block.flights[0].id,
          prevArr: st.lastARR,
          nextDep: block.flights[0].depStation,
        })
      }

      recordAssignment(block, reg)
    }

    // ── Auto-assign free blocks ──
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
          firstFlight, block, states, regs, minTatMs, chainBreaks
        )
      } else {
        bestReg = findBestAircraft(
          firstFlight, block,
          states, regs, minTat, minTatMs, chainBreaks
        )
      }

      if (bestReg) {
        recordAssignment(block, bestReg)
      } else {
        overflow.push(...block.flights)
      }
    }
  })

  return { assignments, overflow, chainBreaks }
}

// ─── Priority-based aircraft selection ────────────────────────

function findBestAircraft(
  firstFlight: AssignableFlight,
  block: AssignmentBlock,
  states: Map<string, AircraftState>,
  regs: AssignableAircraft[],
  minTat: number,
  minTatMs: number,
  chainBreaks: ChainBreak[]
): string | null {
  interface Candidate {
    reg: string
    priority: 1 | 2 | 3
    gap: number
  }

  const candidates: Candidate[] = []
  const firstFlightDateMs = firstFlight.date.getTime()

  for (const ac of regs) {
    const st = states.get(ac.registration)!

    // Full overlap check against ALL existing assignments
    if (!canFitBlock(st, block.startMs, block.endMs, minTatMs)) continue

    // Station chain check: verify block fits the chain
    if (!checkStationChain(st, block)) continue

    const sameStation = st.lastARR === firstFlight.depStation
    const isIdle = st.lastSTA === null

    if (sameStation && !isIdle) {
      // Priority 1: Perfect chain — connects at same station
      const gap = computeGap(st, firstFlight, firstFlightDateMs)
      candidates.push({ reg: ac.registration, priority: 1, gap })
    } else if (sameStation && isIdle) {
      // Priority 2: Same station but aircraft was idle (or at home base)
      candidates.push({ reg: ac.registration, priority: 2, gap: Infinity })
    } else {
      // Priority 3: Available + station chain valid (inserted between compatible flights)
      candidates.push({ reg: ac.registration, priority: 3, gap: Infinity })
    }
  }

  if (candidates.length === 0) return null

  // Sort: priority ASC, then gap ASC (tightest rotation first)
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
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
  minTatMs: number,
  chainBreaks: ChainBreak[]
): string | null {
  interface Candidate {
    reg: string
    score: number
  }

  const candidates: Candidate[] = []
  const blockFirstDep = firstFlight.depStation

  for (const ac of regs) {
    const st = states.get(ac.registration)!

    // Full overlap check against ALL existing assignments
    if (!canFitBlock(st, block.startMs, block.endMs, minTatMs)) continue

    // Station chain check: verify block fits the chain
    if (!checkStationChain(st, block)) continue

    let score = 0

    // UTILIZATION SCORE (primary):
    // Prefer aircraft with FEWER block minutes — this is what makes it "balanced"
    const totalBlockMinutes = st.assignedFlights.reduce((sum, f) => {
      return sum + (toAbsoluteMs(f.date, f.staMinutes) - toAbsoluteMs(f.date, f.stdMinutes)) / 60000
    }, 0)
    score -= totalBlockMinutes * 2

    // CHAIN BONUS:
    // If this aircraft's last arrival matches block's first departure → perfect chain
    if (st.lastARR && st.lastARR === blockFirstDep && st.lastSTA !== null) {
      score += 500
    }

    // EMPTY AIRCRAFT BONUS:
    // Aircraft with zero flights today gets a bonus to encourage spreading
    if (st.assignedFlights.length === 0) {
      score += 300
    }

    // TIME GAP PENALTY:
    // If aircraft has been idle for a long time, slight penalty
    if (st.lastSTA !== null && st.lastSTADate !== null) {
      const lastEndMs = st.lastSTADate + st.lastSTA * 60000
      const gapMinutes = (block.startMs - lastEndMs) / 60000
      if (gapMinutes > 360) {
        score -= 50
      }
    }

    candidates.push({ reg: ac.registration, score })
  }

  if (candidates.length === 0) return null

  // Pick the aircraft with highest score
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0].reg
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
