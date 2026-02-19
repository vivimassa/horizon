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
    message?: string
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
const FAMILY_SUB_COST = 500

// ─── Size limits (browser WASM memory is limited) ─────────────
// With clique-based overlaps these are much more generous
const MAX_VARIABLES = 200000
const MAX_CONSTRAINTS = 500000

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

// ─── Overlap clique finder (sweep line) ──────────────────────

function findOverlapCliques(typeBlocks: MIPBlock[], tatMs: number): MIPBlock[][] {
  const sorted = [...typeBlocks].sort((a, b) => a.startMs - b.startMs)
  const cliques: MIPBlock[][] = []

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    const clique: MIPBlock[] = [current]

    // Find all blocks that overlap with current (including TAT buffer)
    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].startMs >= current.endMs + tatMs) break
      clique.push(sorted[j])
    }

    // Only add if clique has 2+ blocks
    if (clique.length >= 2) {
      cliques.push(clique)
    }
  }

  return cliques
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

  let scopeMatch = false
  if (rule.scope_type === 'all') scopeMatch = true
  else if (rule.scope_type === 'type') scopeMatch = rule.scope_values.includes(ac.icaoType)
  else if (rule.scope_type === 'family') {
    const fam = aircraftFamilies?.get(ac.registration)
    scopeMatch = fam !== undefined && rule.scope_values.includes(fam)
  }
  else if (rule.scope_type === 'registration') scopeMatch = rule.scope_values.includes(ac.registration)
  if (!scopeMatch) return { violated: false, isHard: false, cost: 0 }

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

// ─── Base result fields helper ───────────────────────────────

function makeBaseFields(totalFlights: number) {
  return {
    ruleViolations: new Map<string, RuleViolation[]>(),
    rejections: new Map<string, RejectionReason[]>(),
    summary: { totalFlights, assigned: 0, overflowed: totalFlights, hardRulesEnforced: 0, softRulesBent: 0, totalPenaltyCost: 0 },
  }
}

function makeErrorResult(
  flights: AssignableFlight[],
  vars: number, constraints: number,
  elapsedMs: number, timeLimitSec: number,
  message?: string,
): MIPResult {
  return {
    ...makeBaseFields(flights.length),
    assignments: new Map(),
    overflow: [...flights],
    chainBreaks: [],
    mip: {
      status: 'Error' as const,
      objectiveValue: 0,
      totalVariables: vars,
      totalConstraints: constraints,
      elapsedMs,
      timeLimitSec,
      message,
    },
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
  allowFamilySub: boolean = false,
  typeFamilyMap: Map<string, string> = new Map(),
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

  // ── Build family-based aircraft groups (for allowFamilySub) ──
  const acByFamily = new Map<string, number[]>()
  if (allowFamilySub) {
    aircraft.forEach((ac, i) => {
      const family = typeFamilyMap.get(ac.icaoType)
      if (family) {
        const list = acByFamily.get(family) || []
        list.push(i)
        acByFamily.set(family, list)
      }
    })
  }

  // Helper: get eligible aircraft indices for a block
  function getEligibleAc(block: MIPBlock): number[] {
    if (!allowFamilySub) return acByType.get(block.icaoType) || []
    const family = typeFamilyMap.get(block.icaoType)
    if (family) return acByFamily.get(family) || acByType.get(block.icaoType) || []
    return acByType.get(block.icaoType) || []
  }

  // ── Group blocks by type (or family when allowFamilySub) ──
  const blockGroups = new Map<string, MIPBlock[]>()
  for (const block of allBlocks) {
    const groupKey = allowFamilySub
      ? (typeFamilyMap.get(block.icaoType) || block.icaoType)
      : block.icaoType
    const list = blockGroups.get(groupKey) || []
    list.push(block)
    blockGroups.set(groupKey, list)
  }

  // ── Build overlap cliques per group (sweep line) ──
  report('building', 'Computing overlap cliques...')

  const cliquesByGroup = new Map<string, MIPBlock[][]>()

  for (const [groupKey, groupBlocks] of Array.from(blockGroups.entries())) {
    // Use min TAT across all types in this group
    let minTatMs = Infinity
    for (const b of groupBlocks) {
      const t = (tatMinutes.get(b.icaoType) ?? 30) * 60000
      if (t < minTatMs) minTatMs = t
    }
    if (!isFinite(minTatMs)) minTatMs = 30 * 60000
    cliquesByGroup.set(groupKey, findOverlapCliques(groupBlocks, minTatMs))
  }

  // ── Identify consecutive block pairs for chain break cost ──
  interface SeqPair {
    block1: MIPBlock
    block2: MIPBlock
    groupKey: string
    chainBreak: boolean
  }

  const seqPairs: SeqPair[] = []

  for (const [groupKey, groupBlocks] of Array.from(blockGroups.entries())) {
    const sorted = [...groupBlocks].sort((a, b) => a.startMs - b.startMs)
    let minTatMs = Infinity
    for (const b of sorted) {
      const t = (tatMinutes.get(b.icaoType) ?? 30) * 60000
      if (t < minTatMs) minTatMs = t
    }
    if (!isFinite(minTatMs)) minTatMs = 30 * 60000

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].startMs >= sorted[i].endMs + minTatMs) {
          const arr = sorted[i].flights[sorted[i].flights.length - 1].arrStation
          const dep = sorted[j].flights[0].depStation
          seqPairs.push({
            block1: sorted[i],
            block2: sorted[j],
            groupKey,
            chainBreak: arr !== dep,
          })
          break // Only nearest successor
        }
      }
    }
  }

  const chainBreakPairs = seqPairs.filter(p => p.chainBreak)

  // ── EARLY SIZE ESTIMATION (before building the LP string) ──
  report('building', 'Estimating model size...')

  let estVars = 0
  let estConstraints = 0

  for (const block of allBlocks) {
    if (block.pinned) continue
    const acCount = getEligibleAc(block).length
    estVars += acCount   // x vars
    estVars += 1         // s var (slack)
    estConstraints += 1  // assignment constraint
  }

  for (const [groupKey, cliques] of Array.from(cliquesByGroup.entries())) {
    const acCount = allowFamilySub
      ? (acByFamily.get(groupKey) || []).length
      : (acByType.get(groupKey) || []).length
    estConstraints += cliques.length * acCount
  }

  // Chain break y-variables & constraints
  let estChainVars = 0
  let estChainConstraints = 0
  for (const pair of chainBreakPairs) {
    const acCount = allowFamilySub
      ? (acByFamily.get(pair.groupKey) || []).length
      : (acByType.get(pair.block1.icaoType) || []).length
    estChainVars += acCount
    estChainConstraints += acCount
  }

  // Include chain breaks if they fit
  const includeChainBreaks = (estVars + estChainVars) <= MAX_VARIABLES
    && (estConstraints + estChainConstraints) <= MAX_CONSTRAINTS

  if (includeChainBreaks) {
    estVars += estChainVars
    estConstraints += estChainConstraints
  }

  report('building', `Estimated: ~${estVars.toLocaleString()} vars, ~${estConstraints.toLocaleString()} constraints${!includeChainBreaks && chainBreakPairs.length > 0 ? ' (chain breaks skipped)' : ''}`)

  if (estVars > MAX_VARIABLES || estConstraints > MAX_CONSTRAINTS) {
    const msg = `Model too large (${estVars.toLocaleString()} variables, ${estConstraints.toLocaleString()} constraints). Try reducing the date range or use AI Optimizer instead.`
    report('building', msg)
    return makeErrorResult(flights, estVars, estConstraints, performance.now() - startTime, config.timeLimitSec, msg)
  }

  // Yield to UI before heavy LP string generation
  await new Promise(r => setTimeout(r, 0))

  // ── Generate LP format string ──
  report('building', 'Building LP model...')

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

  // Chain break costs (only if model is small enough)
  if (includeChainBreaks) {
    for (const pair of chainBreakPairs) {
      const eligibleAc = allowFamilySub
        ? (acByFamily.get(pair.groupKey) || [])
        : (acByType.get(pair.block1.icaoType) || [])
      for (const acIdx of eligibleAc) {
        const yVar = `y_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}`
        objTerms.push(`${CHAIN_BREAK_COST} ${yVar}`)
        addVar(yVar)
      }
    }
  }

  // Family substitution penalty + soft rule penalties + hard block tracking
  const hardBlocked = new Set<string>()

  for (const block of allBlocks) {
    if (block.pinned) continue
    const eligibleAc = getEligibleAc(block)

    for (const acIdx of eligibleAc) {
      const ac = aircraft[acIdx]
      let softCost = 0
      let isHardBlocked = false

      // Family substitution penalty (prefer exact type match)
      if (allowFamilySub && ac.icaoType !== block.icaoType) {
        const blockFamily = typeFamilyMap.get(block.icaoType)
        const acFamily = typeFamilyMap.get(ac.icaoType)
        if (blockFamily && blockFamily === acFamily) {
          softCost += FAMILY_SUB_COST
        }
      }

      // Rule penalties
      if (rules && rules.length > 0) {
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
      }

      const xVar = `x_B${block.index}_A${acIdx}`
      if (isHardBlocked) {
        hardBlocked.add(`${block.index}_${acIdx}`)
      } else if (softCost > 0) {
        objTerms.push(`${softCost} ${xVar}`)
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
    const eligibleAc = getEligibleAc(block)
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

  // CONSTRAINT 3: No overlapping blocks on same aircraft (CLIQUE-BASED)
  // Each clique = a maximal set of mutually overlapping blocks.
  // One constraint per clique per aircraft: sum(x_{b,a}) <= 1
  // This replaces O(pairs × aircraft) with O(cliques × aircraft).
  for (const [groupKey, cliques] of Array.from(cliquesByGroup.entries())) {
    const eligibleAc = allowFamilySub
      ? (acByFamily.get(groupKey) || [])
      : (acByType.get(groupKey) || [])
    for (const clique of cliques) {
      for (const acIdx of eligibleAc) {
        const terms = clique.map(b => `x_B${b.index}_A${acIdx}`).join(' + ')
        lines.push(`  clq_${constraintCount}: ${terms} <= 1`)
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

  // CONSTRAINT 5: Sequencing (chain break linearization) — only for small models
  if (includeChainBreaks) {
    for (const pair of chainBreakPairs) {
      const eligibleAc = allowFamilySub
        ? (acByFamily.get(pair.groupKey) || [])
        : (acByType.get(pair.block1.icaoType) || [])
      for (const acIdx of eligibleAc) {
        const yVar = `y_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}`
        lines.push(`  seq_B${pair.block1.index}_B${pair.block2.index}_A${acIdx}: ${yVar} - x_B${pair.block1.index}_A${acIdx} - x_B${pair.block2.index}_A${acIdx} >= -1`)
        constraintCount++
      }
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

  report('building', `Model: ${binaryVars.length} vars, ${constraintCount} constraints (${(lpString.length / 1024).toFixed(0)} KB)`)

  // Yield before solver load
  await new Promise(r => setTimeout(r, 0))

  // ── Solve with HiGHS ──
  report('solving', 'Loading HiGHS solver...')

  try {
    const highsLoader = (await import('highs')).default
    const highs = await highsLoader({
      locateFile: (file: string) =>
        `https://lovasoa.github.io/highs-js/${file}`,
    })

    report('solving', `Solving MIP (time limit: ${config.timeLimitSec}s)...`)

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
        const eligibleAc = getEligibleAc(block)

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

      // Extract chain breaks from y variables (if modeled)
      if (includeChainBreaks) {
        for (const pair of chainBreakPairs) {
          const eligibleAc = allowFamilySub
            ? (acByFamily.get(pair.groupKey) || [])
            : (acByType.get(pair.block1.icaoType) || [])
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
        // Compute chain breaks post-hoc from assignments
        const acBlocks = new Map<string, MIPBlock[]>()
        for (const block of allBlocks) {
          const reg = block.pinnedReg || (() => {
            for (const acIdx of getEligibleAc(block)) {
              const xVar = `x_B${block.index}_A${acIdx}`
              const col = columns[xVar]
              if (col && col.Primal > 0.5) return aircraft[acIdx].registration
            }
            return null
          })()
          if (!reg) continue
          const list = acBlocks.get(reg) || []
          list.push(block)
          acBlocks.set(reg, list)
        }
        for (const [, blocks] of Array.from(acBlocks.entries())) {
          blocks.sort((a, b) => a.startMs - b.startMs)
          for (let i = 0; i < blocks.length - 1; i++) {
            const prev = blocks[i]
            const next = blocks[i + 1]
            const prevArr = prev.flights[prev.flights.length - 1].arrStation
            const nextDep = next.flights[0].depStation
            if (prevArr !== nextDep) {
              chainBreaks.push({
                flightId: next.flights[0].id,
                prevArr,
                nextDep,
              })
            }
          }
        }
      }
    } else {
      for (const f of flights) overflow.push(f)
    }

    const elapsedMs = performance.now() - startTime

    return {
      ...makeBaseFields(flights.length),
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
    return makeErrorResult(flights, binaryVars.length, constraintCount, performance.now() - startTime, config.timeLimitSec, e?.message)
  }
}
