/**
 * Simulated Annealing optimizer for tail assignment.
 * Takes a greedy solution as input and iteratively improves it
 * by exploring random block swaps between aircraft.
 */

import type {
  AssignableFlight, AssignableAircraft,
  TailAssignmentResult, ChainBreak,
} from './tail-assignment'

// ─── Types ────────────────────────────────────────────────────

export interface SAConfig {
  /** Max runtime in milliseconds */
  timeBudgetMs: number
  /** Starting temperature (higher = more random exploration) */
  initialTemp: number
  /** Cooling factor per iteration (0.99-0.9999) */
  coolingRate: number
  /** How often to report progress (ms) */
  reportIntervalMs: number
}

export interface SAProgress {
  /** Current iteration number */
  iteration: number
  /** Current solution cost */
  currentCost: number
  /** Best solution cost found so far */
  bestCost: number
  /** Initial (greedy) cost */
  initialCost: number
  /** Improvement percentage */
  improvement: number
  /** Current temperature */
  temperature: number
  /** Elapsed time in ms */
  elapsedMs: number
  /** Swaps accepted */
  acceptedSwaps: number
  /** Swaps rejected */
  rejectedSwaps: number
  /** Time budget for progress ring */
  timeBudgetMs: number
}

export interface SAResult extends TailAssignmentResult {
  /** SA-specific metadata */
  sa: {
    initialCost: number
    finalCost: number
    improvement: number
    iterations: number
    acceptedSwaps: number
    rejectedSwaps: number
    elapsedMs: number
    timeBudgetMs: number
  }
}

// Default config presets
export const SA_PRESETS = {
  quick:  { timeBudgetMs: 5000,  initialTemp: 5000,  coolingRate: 0.999,  reportIntervalMs: 200 },
  normal: { timeBudgetMs: 15000, initialTemp: 8000,  coolingRate: 0.9995, reportIntervalMs: 300 },
  deep:   { timeBudgetMs: 30000, initialTemp: 10000, coolingRate: 0.9998, reportIntervalMs: 500 },
} as const

// ─── Block type for SA (simplified) ──────────────────────────

interface SABlock {
  id: string
  flights: AssignableFlight[]
  icaoType: string
  startMs: number
  endMs: number
  pinned: boolean
}

// ─── Cost function ────────────────────────────────────────────

function calculateSolutionCost(
  assignments: Map<string, string>,
  overflow: AssignableFlight[],
  blocks: SABlock[],
  aircraft: AssignableAircraft[],
  tatMs: Map<string, number>,
): number {
  let cost = 0

  // Overflow cost — very high to discourage it
  cost += overflow.length * 50000

  // Build per-aircraft assignment list
  const acBlocks = new Map<string, SABlock[]>()
  for (const ac of aircraft) acBlocks.set(ac.registration, [])

  for (const block of blocks) {
    const reg = assignments.get(block.flights[0].id)
    if (reg) {
      const list = acBlocks.get(reg)
      if (list) list.push(block)
    }
  }

  // Per-aircraft costs
  const blockMinutesPerAc: number[] = []

  for (const [reg, regBlocks] of Array.from(acBlocks.entries())) {
    regBlocks.sort((a, b) => a.startMs - b.startMs)

    let totalBlockMins = 0

    for (let i = 0; i < regBlocks.length; i++) {
      const block = regBlocks[i]
      totalBlockMins += (block.endMs - block.startMs) / 60000

      if (i > 0) {
        const prev = regBlocks[i - 1]
        const prevArr = prev.flights[prev.flights.length - 1].arrStation
        const currDep = block.flights[0].depStation

        // Chain break cost
        if (prevArr !== currDep) {
          cost += 5000
        }

        // TAT violation cost
        const gapMs = block.startMs - prev.endMs
        const acType = aircraft.find(a => a.registration === reg)?.icaoType || ''
        const requiredTat = tatMs.get(acType) || 30 * 60000
        if (gapMs < requiredTat && gapMs > 0) {
          cost += 3000
        }

        // Idle gap cost (long gaps = inefficient)
        const gapHours = gapMs / 3600000
        if (gapHours > 6) {
          cost += Math.floor(gapHours - 6) * 200
        }
      }
    }

    blockMinutesPerAc.push(totalBlockMins)
  }

  // Utilization balance cost — penalize variance
  if (blockMinutesPerAc.length > 1) {
    const mean = blockMinutesPerAc.reduce((a, b) => a + b, 0) / blockMinutesPerAc.length
    const variance = blockMinutesPerAc.reduce((sum, v) => sum + (v - mean) ** 2, 0) / blockMinutesPerAc.length
    cost += Math.sqrt(variance) * 10
  }

  return cost
}

// ─── Main SA function ────────────────────────────────────────

export async function runSimulatedAnnealing(
  greedy: TailAssignmentResult,
  flights: AssignableFlight[],
  aircraft: AssignableAircraft[],
  tatMinutes: Map<string, number>,
  config: SAConfig = SA_PRESETS.normal,
  onProgress?: (progress: SAProgress) => void,
  abortSignal?: AbortSignal,
  allowFamilySub: boolean = false,
  typeFamilyMap: Map<string, string> = new Map(),
): Promise<SAResult> {

  const tatMs = new Map<string, number>()
  for (const [k, v] of Array.from(tatMinutes.entries())) tatMs.set(k, v * 60000)

  // Build SA blocks from flights
  const routeBlockMap = new Map<string, AssignableFlight[]>()

  for (const f of flights) {
    let key: string
    if (f.routeId) {
      const baseDateMs = f.date.getTime() - f.dayOffset * 86400000
      const baseDate = new Date(baseDateMs).toISOString().slice(0, 10)
      key = `route_${f.routeId}_${baseDate}`
    } else {
      key = `standalone_${f.id}`
    }
    const list = routeBlockMap.get(key) || []
    list.push(f)
    routeBlockMap.set(key, list)
  }

  const allBlocks: SABlock[] = []
  for (const [id, blockFlights] of Array.from(routeBlockMap.entries())) {
    blockFlights.sort((a, b) => {
      const da = a.date.getTime() - b.date.getTime()
      return da !== 0 ? da : a.stdMinutes - b.stdMinutes
    })
    const first = blockFlights[0]
    const last = blockFlights[blockFlights.length - 1]

    const toMs = (d: Date, m: number) => d.getTime() + m * 60000

    allBlocks.push({
      id,
      flights: blockFlights,
      icaoType: first.aircraftTypeIcao || 'UNKN',
      startMs: toMs(first.date, first.stdMinutes),
      endMs: toMs(last.date, last.staMinutes),
      pinned: !!blockFlights.find(f => f.aircraftReg),
    })
  }

  // Group aircraft by type
  const aircraftByType = new Map<string, AssignableAircraft[]>()
  for (const ac of aircraft) {
    const list = aircraftByType.get(ac.icaoType) || []
    list.push(ac)
    aircraftByType.set(ac.icaoType, list)
  }

  // Initialize current solution from greedy
  const currentAssignments = new Map(greedy.assignments)
  const currentOverflow = new Set(greedy.overflow.map(f => f.id))

  // Moveable blocks (not pinned, not entirely overflow)
  const moveableBlocks = allBlocks.filter(b =>
    !b.pinned && b.flights.some(f => currentAssignments.has(f.id))
  )

  // Calculate initial cost
  const overflowFlights = flights.filter(f => currentOverflow.has(f.id))
  const initialCost = calculateSolutionCost(
    currentAssignments, overflowFlights, allBlocks, aircraft, tatMs
  )
  let currentCost = initialCost
  let bestCost = initialCost
  let bestAssignments = new Map(currentAssignments)
  let bestOverflow = new Set(currentOverflow)

  // SA parameters
  let temperature = config.initialTemp
  let iteration = 0
  let acceptedSwaps = 0
  let rejectedSwaps = 0

  const startTime = performance.now()
  let lastReportTime = startTime

  // Build per-aircraft block index for fast overlap checks
  const blocksByReg = new Map<string, Set<string>>()
  for (const ac of aircraft) blocksByReg.set(ac.registration, new Set())
  for (const block of allBlocks) {
    const reg = currentAssignments.get(block.flights[0].id)
    if (reg) blocksByReg.get(reg)?.add(block.id)
  }

  // Block lookup by id
  const blockById = new Map<string, SABlock>()
  for (const b of allBlocks) blockById.set(b.id, b)

  // Indexed canPlace: only check blocks assigned to target reg
  function canPlaceIndexed(block: SABlock, reg: string, excludeIds?: Set<string>): boolean {
    const requiredTatMs = tatMs.get(block.icaoType) || 30 * 60000
    const regBlockIds = blocksByReg.get(reg)
    if (!regBlockIds) return true
    for (const otherId of Array.from(regBlockIds)) {
      if (otherId === block.id) continue
      if (excludeIds && excludeIds.has(otherId)) continue
      const other = blockById.get(otherId)
      if (!other) continue
      if (block.startMs < other.endMs + requiredTatMs &&
          other.startMs < block.endMs + requiredTatMs) {
        return false
      }
    }
    return true
  }

  // Helper: get eligible aircraft for a block type
  function getEligible(icaoType: string): AssignableAircraft[] {
    let eligible = aircraftByType.get(icaoType) || []
    if (allowFamilySub) {
      const family = typeFamilyMap.get(icaoType)
      if (family) {
        const familyAc: AssignableAircraft[] = []
        for (const [type, acs] of Array.from(aircraftByType.entries())) {
          if (typeFamilyMap.get(type) === family) familyAc.push(...acs)
        }
        if (familyAc.length >= 2) eligible = familyAc
      }
    }
    return eligible
  }

  // ── Main SA loop ──
  while (true) {
    const elapsed = performance.now() - startTime
    if (elapsed >= config.timeBudgetMs) break
    if (abortSignal?.aborted) break

    iteration++

    // 70% pair swap, 30% relocate
    const doPairSwap = Math.random() < 0.7

    if (doPairSwap) {
      // ── PAIR SWAP: exchange two blocks between different aircraft of same type ──
      const blockA = moveableBlocks[Math.floor(Math.random() * moveableBlocks.length)]
      if (!blockA) continue
      const regA = currentAssignments.get(blockA.flights[0].id)
      if (!regA) continue

      // Find blocks on other aircraft of compatible type
      const sameTypeBlocks = moveableBlocks.filter(b => {
        const r = currentAssignments.get(b.flights[0].id)
        if (!r || r === regA) return false
        if (b.icaoType === blockA.icaoType) return true
        if (allowFamilySub) {
          const fA = typeFamilyMap.get(blockA.icaoType)
          const fB = typeFamilyMap.get(b.icaoType)
          return fA && fA === fB
        }
        return false
      })
      if (sameTypeBlocks.length === 0) continue

      const blockB = sameTypeBlocks[Math.floor(Math.random() * sameTypeBlocks.length)]
      const regB = currentAssignments.get(blockB.flights[0].id)!

      // Check if A fits on regB and B fits on regA (excluding both from overlap)
      const excludeSet = new Set([blockA.id, blockB.id])
      if (!canPlaceIndexed(blockA, regB, excludeSet)) continue
      if (!canPlaceIndexed(blockB, regA, excludeSet)) continue

      // Apply swap
      for (const f of blockA.flights) currentAssignments.set(f.id, regB)
      for (const f of blockB.flights) currentAssignments.set(f.id, regA)

      // Update index
      blocksByReg.get(regA)?.delete(blockA.id)
      blocksByReg.get(regA)?.add(blockB.id)
      blocksByReg.get(regB)?.delete(blockB.id)
      blocksByReg.get(regB)?.add(blockA.id)

      const newCost = calculateSolutionCost(currentAssignments, overflowFlights, allBlocks, aircraft, tatMs)
      const delta = newCost - currentCost

      if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
        currentCost = newCost
        acceptedSwaps++
        if (currentCost < bestCost) {
          bestCost = currentCost
          bestAssignments = new Map(currentAssignments)
          bestOverflow = new Set(currentOverflow)
        }
      } else {
        // Revert swap
        for (const f of blockA.flights) currentAssignments.set(f.id, regA)
        for (const f of blockB.flights) currentAssignments.set(f.id, regB)
        blocksByReg.get(regA)?.add(blockA.id)
        blocksByReg.get(regA)?.delete(blockB.id)
        blocksByReg.get(regB)?.add(blockB.id)
        blocksByReg.get(regB)?.delete(blockA.id)
        rejectedSwaps++
      }

    } else {
      // ── RELOCATE: move a single block to a different aircraft ──
      const block = moveableBlocks[Math.floor(Math.random() * moveableBlocks.length)]
      if (!block) continue

      const eligibleAircraft = getEligible(block.icaoType)
      if (eligibleAircraft.length < 2) continue

      const currentReg = currentAssignments.get(block.flights[0].id) || null
      const targetAc = eligibleAircraft[Math.floor(Math.random() * eligibleAircraft.length)]
      if (targetAc.registration === currentReg) continue

      if (!canPlaceIndexed(block, targetAc.registration)) continue

      // Apply move
      const prevRegs = new Map<string, string | null>()
      for (const f of block.flights) {
        prevRegs.set(f.id, currentAssignments.get(f.id) || null)
        currentAssignments.set(f.id, targetAc.registration)
        currentOverflow.delete(f.id)
      }

      // Update index
      if (currentReg) blocksByReg.get(currentReg)?.delete(block.id)
      blocksByReg.get(targetAc.registration)?.add(block.id)

      const newOverflowFlights = flights.filter(f => currentOverflow.has(f.id))
      const newCost = calculateSolutionCost(currentAssignments, newOverflowFlights, allBlocks, aircraft, tatMs)
      const delta = newCost - currentCost

      if (delta < 0 || Math.random() < Math.exp(-delta / temperature)) {
        currentCost = newCost
        acceptedSwaps++
        if (currentCost < bestCost) {
          bestCost = currentCost
          bestAssignments = new Map(currentAssignments)
          bestOverflow = new Set(currentOverflow)
        }
      } else {
        // Revert
        for (const f of block.flights) {
          const prev = prevRegs.get(f.id)
          if (prev) {
            currentAssignments.set(f.id, prev)
          } else {
            currentAssignments.delete(f.id)
            currentOverflow.add(f.id)
          }
        }
        // Revert index
        blocksByReg.get(targetAc.registration)?.delete(block.id)
        if (currentReg) blocksByReg.get(currentReg)?.add(block.id)
        rejectedSwaps++
      }
    }

    // Cool down
    temperature *= config.coolingRate

    // Report progress periodically
    if (elapsed - (lastReportTime - startTime) > config.reportIntervalMs) {
      lastReportTime = startTime + elapsed
      const improvement = initialCost > 0
        ? ((initialCost - bestCost) / initialCost) * 100
        : 0

      onProgress?.({
        iteration,
        currentCost,
        bestCost,
        initialCost,
        improvement,
        temperature,
        elapsedMs: elapsed,
        acceptedSwaps,
        rejectedSwaps,
        timeBudgetMs: config.timeBudgetMs,
      })

      // Yield to browser to keep UI responsive
      await new Promise(r => setTimeout(r, 0))
    }
  }

  // ── Build final result from best solution ──
  const finalAssignments = bestAssignments
  const finalOverflow = flights.filter(f => bestOverflow.has(f.id))
  const finalChainBreaks: ChainBreak[] = []

  // Recalculate chain breaks from final solution
  const acBlocksFinal = new Map<string, SABlock[]>()
  for (const ac of aircraft) acBlocksFinal.set(ac.registration, [])
  for (const block of allBlocks) {
    const reg = finalAssignments.get(block.flights[0].id)
    if (reg) {
      const list = acBlocksFinal.get(reg)
      if (list) list.push(block)
    }
  }
  for (const [, regBlocks] of Array.from(acBlocksFinal.entries())) {
    regBlocks.sort((a, b) => a.startMs - b.startMs)
    for (let i = 1; i < regBlocks.length; i++) {
      const prev = regBlocks[i - 1]
      const curr = regBlocks[i]
      const prevArr = prev.flights[prev.flights.length - 1].arrStation
      const currDep = curr.flights[0].depStation
      if (prevArr !== currDep) {
        finalChainBreaks.push({
          flightId: curr.flights[0].id,
          prevArr,
          nextDep: currDep,
        })
      }
    }
  }

  const elapsedMs = performance.now() - startTime
  const improvement = initialCost > 0
    ? ((initialCost - bestCost) / initialCost) * 100
    : 0

  return {
    assignments: finalAssignments,
    overflow: finalOverflow,
    chainBreaks: finalChainBreaks,
    ruleViolations: greedy.ruleViolations,
    rejections: greedy.rejections,
    summary: {
      totalFlights: flights.length,
      assigned: finalAssignments.size,
      overflowed: finalOverflow.length,
      hardRulesEnforced: greedy.summary.hardRulesEnforced,
      softRulesBent: greedy.summary.softRulesBent,
      totalPenaltyCost: greedy.summary.totalPenaltyCost,
    },
    sa: {
      initialCost,
      finalCost: bestCost,
      improvement,
      iterations: iteration,
      acceptedSwaps,
      rejectedSwaps,
      elapsedMs,
      timeBudgetMs: config.timeBudgetMs,
    },
  }
}
