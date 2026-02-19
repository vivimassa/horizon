import type {
  AssignableFlight, AssignableAircraft,
  TailAssignmentResult, ChainBreak,
} from './tail-assignment'
import type { RuleViolation, RejectionReason } from './schedule-rule-evaluator'
import { AIRPORT_COUNTRY } from '@/lib/data/airport-countries'

// ─── Types ────────────────────────────────────────────────────

export interface MIPConfig {
  /** Max solver time in seconds */
  timeLimitSec: number
  /** MIP relative gap tolerance (0.01 = 1% from optimal) */
  mipGap: number
}

export interface MIPProgress {
  phase: 'building' | 'solving' | 'extracting'
  message: string
  elapsedMs: number
}

export interface MIPResult extends TailAssignmentResult {
  mip: {
    status: 'Optimal' | 'Feasible' | 'Infeasible' | 'TimeLimitReached' | 'Error'
    objectiveValue: number
    totalVariables: number
    totalConstraints: number
    elapsedMs: number
    timeLimitSec: number
    gap?: number
  }
}

export const MIP_PRESETS = {
  quick:  { timeLimitSec: 15,  mipGap: 0.05 },
  normal: { timeLimitSec: 45,  mipGap: 0.02 },
  deep:   { timeLimitSec: 120, mipGap: 0.005 },
} as const

// ─── Cost weights (same scale as penalty system) ──────────────

const OVERFLOW_COST = 50000
const CHAIN_BREAK_COST = 5000

// ─── Block type ──────────────────────────────────────────────

interface MIPBlock {
  id: string
  index: number
  flights: AssignableFlight[]
  icaoType: string
  startMs: number
  endMs: number
  pinned: boolean
  pinnedReg: string | null
  blockMinutes: number
}

// ─── Rule evaluation helper ──────────────────────────────────

function checkRuleViolation(
  rule: { scope_type: string; scope_values: string[]; action: string;
    criteria_type: string; criteria_values: any; enforcement: string;
    penalty_cost: number; is_active: boolean },
  ac: AssignableAircraft,
  block: MIPBlock,
  aircraftFamilies?: Map<string, string>,
): { violated: boolean; isHard: boolean; cost: number } {
  if (!rule.is_active) return { violated: false, isHard: false, cost: 0 }
  if (rule.enforcement !== 'hard' && rule.enforcement !== 'soft')
    return { violated: false, isHard: false, cost: 0 }

  // Scope check
  let scopeMatch = false
  if (rule.scope_type === 'all') scopeMatch = true
  else if (rule.scope_type === 'type') scopeMatch = rule.scope_values.includes(ac.icaoType)
  else if (rule.scope_type === 'family') {
    const fam = aircraftFamilies?.get(ac.registration)
    scopeMatch = fam !== undefined && rule.scope_values.includes(fam)
  }
  else if (rule.scope_type === 'registration') scopeMatch = rule.scope_values.includes(ac.registration)
  if (!scopeMatch) return { violated: false, isHard: false, cost: 0 }

  // Criteria check (against first flight in block)
  const f = block.flights[0]
  let criteriaMatch = false
  const cv = rule.criteria_values || {}

  switch (rule.criteria_type) {
    case 'airports': {
      const airports = cv.airports || []
      const dir = cv.direction || 'any'
      criteriaMatch = dir === 'to' ? airports.includes(f.arrStation)
        : dir === 'from' ? airports.includes(f.depStation)
        : airports.includes(f.depStation) || airports.includes(f.arrStation)
      break
    }
    case 'routes':
      criteriaMatch = (cv.routes || []).includes(`${f.depStation}-${f.arrStation}`)
      break
    case 'international': {
      const dc = AIRPORT_COUNTRY[f.depStation]
      const ac2 = AIRPORT_COUNTRY[f.arrStation]
      criteriaMatch = !!dc && !!ac2 && dc !== ac2
      break
    }
    case 'domestic': {
      const dc2 = AIRPORT_COUNTRY[f.depStation]
      const ac3 = AIRPORT_COUNTRY[f.arrStation]
      criteriaMatch = !!dc2 && !!ac3 && dc2 === ac3 && dc2 === 'VN'
      break
    }
    case 'service_type':
      criteriaMatch = (cv.types || []).includes(f.serviceType || 'J')
      break
    case 'overnight':
      criteriaMatch = f.staMinutes > 1440 || f.staMinutes < f.stdMinutes
      break
    case 'day_of_week': {
      const jsDay = f.date.getDay()
      const isoDay = jsDay === 0 ? 7 : jsDay
      criteriaMatch = (cv.days || []).includes(isoDay)
      break
    }
    case 'departure_time': {
      const [fh, fm] = (cv.from || '00:00').split(':').map(Number)
      const [th, tm] = (cv.to || '23:59').split(':').map(Number)
      const fromM = fh * 60 + fm
      const toM = th * 60 + tm
      const std = f.stdMinutes % 1440
      criteriaMatch = fromM <= toM ? std >= fromM && std <= toM : std >= fromM || std <= toM
      break
    }
    case 'block_time': {
      const mins = cv.minutes || 0
      switch (cv.operator || 'gt') {
        case 'gt': criteriaMatch = block.blockMinutes > mins; break
        case 'lt': criteriaMatch = block.blockMinutes < mins; break
        case 'gte': criteriaMatch = block.blockMinutes >= mins; break
        case 'lte': criteriaMatch = block.blockMinutes <= mins; break
        case 'eq': criteriaMatch = block.blockMinutes === mins; break
      }
      break
    }
  }

  const violated =
    (rule.action === 'must_not_fly' || rule.action === 'should_avoid') ? criteriaMatch
    : rule.action === 'can_only_fly' ? !criteriaMatch
    : false

  if (!violated) return { violated: false, isHard: false, cost: 0 }

  return {
    violated: true,
    isHard: rule.enforcement === 'hard',
    cost: rule.penalty_cost || 3000,
  }
}

// ─── Main function ───────────────────────────────────────────

export async function runMIPSolver(
  flights: AssignableFlight[],
  aircraft: AssignableAircraft[],
  tatMinutes: Map<string, number>,
  config: MIPConfig = MIP_PRESETS.normal,
  onProgress?: (progress: MIPProgress) => void,
  rules?: { scope_type: string; scope_values: string[]; action: string;
    criteria_type: string; criteria_values: any; enforcement: string;
    penalty_cost: number; is_active: boolean }[],
  aircraftFamilies?: Map<string, string>,
): Promise<MIPResult> {

  const startTime = performance.now()

  const report = (phase: MIPProgress['phase'], message: string) => {
    onProgress?.({ phase, message, elapsedMs: performance.now() - startTime })
  }

  report('building', 'Building flight blocks...')

  // ── Build blocks (same logic as greedy engine) ──
  const blockMap = new Map<string, AssignableFlight[]>()
  for (const f of flights) {
    let key: string
    if (f.routeId) {
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

  const allBlocks: MIPBlock[] = []
  let blockIndex = 0
  for (const [id, blockFlights] of Array.from(blockMap.entries())) {
    blockFlights.sort((a, b) => {
      const da = a.date.getTime() - b.date.getTime()
      return da !== 0 ? da : a.stdMinutes - b.stdMinutes
    })
    const first = blockFlights[0]
    const last = blockFlights[blockFlights.length - 1]
    const toMs = (d: Date, m: number) => d.getTime() + m * 60000

    allBlocks.push({
      id,
      index: blockIndex++,
      flights: blockFlights,
      icaoType: first.aircraftTypeIcao || 'UNKN',
      startMs: toMs(first.date, first.stdMinutes),
      endMs: toMs(last.date, last.staMinutes),
      pinned: !!blockFlights.find(f => f.aircraftReg),
      pinnedReg: blockFlights.find(f => f.aircraftReg)?.aircraftReg || null,
      blockMinutes: (toMs(last.date, last.staMinutes) - toMs(first.date, first.stdMinutes)) / 60000,
    })
  }

  report('building', `${allBlocks.length} blocks, ${aircraft.length} aircraft`)

  // ── Build eligible aircraft for each block ──
  const acIndex = new Map<string, number>()
  aircraft.forEach((ac, i) => acIndex.set(ac.registration, i))

  const acByType = new Map<string, number[]>()
  aircraft.forEach((ac, i) => {
    const list = acByType.get(ac.icaoType) || []
    list.push(i)
    acByType.set(ac.icaoType, list)
  })

  // ── Identify overlapping block pairs per aircraft type ──
  report('building', 'Computing overlap constraints...')

  interface OverlapPair {
    block1: number
    block2: number
  }

  const overlapsByType = new Map<string, OverlapPair[]>()

  // Group blocks by type
  const blocksByType = new Map<string, MIPBlock[]>()
  for (const block of allBlocks) {
    const list = blocksByType.get(block.icaoType) || []
    list.push(block)
    blocksByType.set(block.icaoType, list)
  }

  for (const [icaoType, typeBlocks] of Array.from(blocksByType.entries())) {
    const tatMs = (tatMinutes.get(icaoType) ?? 30) * 60000
    const overlaps: OverlapPair[] = []

    typeBlocks.sort((a, b) => a.startMs - b.startMs)

    for (let i = 0; i < typeBlocks.length; i++) {
      for (let j = i + 1; j < typeBlocks.length; j++) {
        const a = typeBlocks[i]
        const b = typeBlocks[j]
        if (b.startMs >= a.endMs + tatMs) break
        if (a.startMs < b.endMs + tatMs && b.startMs < a.endMs + tatMs) {
          overlaps.push({ block1: a.index, block2: b.index })
        }
      }
    }

    overlapsByType.set(icaoType, overlaps)
  }

  // ── Identify consecutive block pairs for chain break cost ──
  report('building', 'Building LP model...')

  interface SeqPair {
    block1: MIPBlock
    block2: MIPBlock
    chainBreak: boolean
  }

  const seqPairs: SeqPair[] = []

  for (const [, typeBlocks] of Array.from(blocksByType.entries())) {
    const sorted = [...typeBlocks].sort((a, b) => a.startMs - b.startMs)
    const tatMs = (tatMinutes.get(sorted[0]?.icaoType ?? '') ?? 30) * 60000

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].startMs >= sorted[i].endMs + tatMs) {
          const arr = sorted[i].flights[sorted[i].flights.length - 1].arrStation
          const dep = sorted[j].flights[0].depStation
          seqPairs.push({
            block1: sorted[i],
            block2: sorted[j],
            chainBreak: arr !== dep,
          })
          break // Only nearest successor
        }
      }
    }
  }

  // ── Generate LP format string ──
  const lines: string[] = []
  const varSet = new Set<string>()
  const binaryVars: string[] = []

  const addVar = (name: string) => {
    if (!varSet.has(name)) {
      varSet.add(name)
      binaryVars.push(name)
    }
  }

  // ── Objective ──
  lines.push('Minimize')
  const objTerms: string[] = []

  // Overflow costs
  for (const block of allBlocks) {
    if (block.pinned) continue
    const varName = `s_B${block.index}`
    objTerms.push(`${OVERFLOW_COST} ${varName}`)
    addVar(varName)
  }

  // Chain break costs
  for (const pair of seqPairs) {
    if (!pair.chainBreak) continue
    const eligibleAc = acByType.get(pair.block1.icaoType) || []
    for (const acIdx of eligibleAc) {
      const yVar = `y_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}`
      objTerms.push(`${CHAIN_BREAK_COST} ${yVar}`)
      addVar(yVar)
    }
  }

  // Soft rule penalties
  // Pre-compute hard blocks for constraint generation
  const hardBlocked = new Set<string>() // "blockIdx_acIdx"

  if (rules && rules.length > 0) {
    for (const block of allBlocks) {
      if (block.pinned) continue
      const eligibleAc = acByType.get(block.icaoType) || []

      for (const acIdx of eligibleAc) {
        const ac = aircraft[acIdx]
        let softCost = 0
        let isHardBlocked = false

        for (const rule of rules) {
          const result = checkRuleViolation(rule, ac, block, aircraftFamilies)
          if (result.violated) {
            if (result.isHard) {
              isHardBlocked = true
              break
            } else {
              softCost += result.cost
            }
          }
        }

        const xVar = `x_B${block.index}_A${acIdx}`
        if (isHardBlocked) {
          hardBlocked.add(`${block.index}_${acIdx}`)
        } else if (softCost > 0) {
          objTerms.push(`${softCost} ${xVar}`)
        }
      }
    }
  }

  lines.push(`  obj: ${objTerms.length > 0 ? objTerms.join(' + ') : '0 dummy'}`)

  // ── Constraints ──
  lines.push('Subject To')
  let constraintCount = 0

  // CONSTRAINT 1: Each non-pinned block → exactly one aircraft OR overflows
  for (const block of allBlocks) {
    if (block.pinned) continue
    const eligibleAc = acByType.get(block.icaoType) || []
    if (eligibleAc.length === 0) continue

    const terms = eligibleAc.map(acIdx => `x_B${block.index}_A${acIdx}`)
    terms.push(`s_B${block.index}`)
    lines.push(`  assign_B${block.index}: ${terms.join(' + ')} = 1`)
    constraintCount++

    for (const acIdx of eligibleAc) {
      addVar(`x_B${block.index}_A${acIdx}`)
    }
  }

  // CONSTRAINT 2: Pinned blocks — fix assignment
  for (const block of allBlocks) {
    if (!block.pinned || !block.pinnedReg) continue
    const idx = acIndex.get(block.pinnedReg)
    if (idx === undefined) continue
    const xVar = `x_B${block.index}_A${idx}`
    lines.push(`  pin_B${block.index}: ${xVar} = 1`)
    constraintCount++
    addVar(xVar)
  }

  // CONSTRAINT 3: No overlapping blocks on same aircraft
  for (const [icaoType, overlaps] of Array.from(overlapsByType.entries())) {
    const eligibleAc = acByType.get(icaoType) || []
    for (const pair of overlaps) {
      for (const acIdx of eligibleAc) {
        lines.push(`  ovlp_B${pair.block1}_B${pair.block2}_A${acIdx}: x_B${pair.block1}_A${acIdx} + x_B${pair.block2}_A${acIdx} <= 1`)
        constraintCount++
      }
    }
  }

  // CONSTRAINT 4: Hard rule blocking — x = 0
  for (const key of Array.from(hardBlocked)) {
    const [bi, ai] = key.split('_')
    lines.push(`  hrule_B${bi}_A${ai}: x_B${bi}_A${ai} = 0`)
    constraintCount++
  }

  // CONSTRAINT 5: Sequencing (chain break linearization)
  // y_{i,j,a} >= x_{i,a} + x_{j,a} - 1
  for (const pair of seqPairs) {
    if (!pair.chainBreak) continue
    const eligibleAc = acByType.get(pair.block1.icaoType) || []
    for (const acIdx of eligibleAc) {
      const yVar = `y_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}`
      lines.push(`  seq_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}: ${yVar} - x_B${pair.block1.index}_A${acIdx} - x_B${pair.block2.index}_A${acIdx} >= -1`)
      constraintCount++
    }
  }

  // ── Bounds ──
  lines.push('Bounds')
  for (const v of binaryVars) {
    lines.push(`  0 <= ${v} <= 1`)
  }

  // ── Binary section ──
  lines.push('Binary')
  for (let i = 0; i < binaryVars.length; i += 10) {
    lines.push('  ' + binaryVars.slice(i, i + 10).join(' '))
  }

  lines.push('End')

  const lpString = lines.join('\n')

  report('building', `Model: ${binaryVars.length} variables, ${constraintCount} constraints`)

  // Helper to build base result fields
  const baseFields = () => ({
    ruleViolations: new Map<string, RuleViolation[]>(),
    rejections: new Map<string, RejectionReason[]>(),
    summary: { totalFlights: flights.length, assigned: 0, overflowed: flights.length, hardRulesEnforced: 0, softRulesBent: 0, totalPenaltyCost: 0 },
  })

  // ── Size guard ──
  if (binaryVars.length > 50000) {
    report('building', 'Model too large for browser solver. Try AI Optimizer instead.')
    return {
      ...baseFields(),
      assignments: new Map(),
      overflow: [...flights],
      chainBreaks: [],
      mip: {
        status: 'Error' as const,
        objectiveValue: 0,
        totalVariables: binaryVars.length,
        totalConstraints: constraintCount,
        elapsedMs: performance.now() - startTime,
        timeLimitSec: config.timeLimitSec,
      },
    }
  }

  // ── Solve with HiGHS ──
  report('solving', 'Loading HiGHS solver...')

  try {
    const highsLoader = (await import('highs')).default
    const highs = await highsLoader({
      locateFile: (file: string) =>
        `https://lovasoa.github.io/highs-js/${file}`,
    })

    report('solving', 'Solving MIP...')

    const solution = highs.solve(lpString, {
      time_limit: config.timeLimitSec,
      mip_rel_gap: config.mipGap,
      presolve: 'on',
      output_flag: false,
    })

    report('extracting', 'Extracting solution...')

    // ── Extract assignments from solution ──
    const assignments = new Map<string, string>()
    const overflow: AssignableFlight[] = []
    const chainBreaks: ChainBreak[] = []

    const solStatus = solution.Status as string

    if (solStatus === 'Optimal' || solStatus === 'Feasible' ||
        solStatus === 'ObjectiveBound' || solStatus === 'Time') {

      const columns = solution.Columns as Record<string, { Primal: number }> || {}

      for (const block of allBlocks) {
        if (block.pinned && block.pinnedReg) {
          for (const f of block.flights) {
            assignments.set(f.id, block.pinnedReg)
          }
          continue
        }

        let assigned = false
        const eligibleAc = acByType.get(block.icaoType) || []

        for (const acIdx of eligibleAc) {
          const xVar = `x_B${block.index}_A${acIdx}`
          const col = columns[xVar]
          if (col && col.Primal > 0.5) {
            const reg = aircraft[acIdx].registration
            for (const f of block.flights) {
              assignments.set(f.id, reg)
            }
            assigned = true
            break
          }
        }

        if (!assigned) {
          overflow.push(...block.flights)
        }
      }

      // Extract chain breaks from y variables
      for (const pair of seqPairs) {
        if (!pair.chainBreak) continue
        const eligibleAc = acByType.get(pair.block1.icaoType) || []
        for (const acIdx of eligibleAc) {
          const yVar = `y_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}`
          const col = columns[yVar]
          if (col && col.Primal > 0.5) {
            chainBreaks.push({
              flightId: pair.block2.flights[0].id,
              prevArr: pair.block1.flights[pair.block1.flights.length - 1].arrStation,
              nextDep: pair.block2.flights[0].depStation,
            })
          }
        }
      }
    } else {
      for (const f of flights) overflow.push(f)
    }

    const elapsedMs = performance.now() - startTime

    return {
      ...baseFields(),
      summary: {
        totalFlights: flights.length,
        assigned: assignments.size,
        overflowed: overflow.length,
        hardRulesEnforced: hardBlocked.size,
        softRulesBent: 0,
        totalPenaltyCost: 0,
      },
      assignments,
      overflow,
      chainBreaks,
      mip: {
        status: (solStatus === 'Optimal' ? 'Optimal'
          : (solStatus === 'Feasible' || solStatus === 'ObjectiveBound' || solStatus === 'Time') ? 'Feasible'
          : solStatus === 'Infeasible' ? 'Infeasible'
          : 'Error') as MIPResult['mip']['status'],
        objectiveValue: solution.ObjectiveValue || 0,
        totalVariables: binaryVars.length,
        totalConstraints: constraintCount,
        elapsedMs,
        timeLimitSec: config.timeLimitSec,
      },
    }

  } catch (e: any) {
    console.error('MIP solver error:', e)
    const elapsedMs = performance.now() - startTime
    return {
      ...baseFields(),
      assignments: new Map(),
      overflow: [...flights],
      chainBreaks: [],
      mip: {
        status: 'Error' as const,
        objectiveValue: 0,
        totalVariables: binaryVars.length,
        totalConstraints: constraintCount,
        elapsedMs,
        timeLimitSec: config.timeLimitSec,
      },
    }
  }
}
