'use client'

import type { ScheduleRule } from '@/app/actions/schedule-rules'
import { AIRPORT_COUNTRY } from '@/lib/data/airport-countries'

// ─── Types ────────────────────────────────────────────────────

export interface FlightForEval {
  id: string
  depStation: string
  arrStation: string
  stdMinutes: number
  staMinutes: number
  blockMinutes: number
  serviceType: string
  date: Date
  aircraftTypeIcao: string | null
}

export interface AircraftForEval {
  registration: string
  icaoType: string
  family: string | null
}

export interface RuleViolation {
  ruleId: string
  ruleName: string | null
  enforcement: 'hard' | 'soft'
  penaltyCost: number
  /** Human-readable explanation */
  message: string
}

/** Why a specific aircraft was NOT chosen for a flight */
export interface RejectionReason {
  registration: string
  icaoType: string
  reason: 'overlap' | 'chain' | 'hard_rule' | 'score'
  /** For hard_rule: which rule blocked it */
  ruleViolations?: RuleViolation[]
  /** For score: what the total cost was */
  totalCost?: number
}

export interface EvalResult {
  allowed: boolean
  violations: RuleViolation[]
  /** Total penalty cost from soft violations */
  totalPenalty: number
}

// ─── Operator's home country ──────────────────────────────────
const OPERATOR_COUNTRY = 'VN'

// ─── Main evaluator ──────────────────────────────────────────

export function evaluateRules(
  flight: FlightForEval,
  aircraft: AircraftForEval,
  rules: ScheduleRule[]
): EvalResult {
  const violations: RuleViolation[] = []
  let totalPenalty = 0

  for (const rule of rules) {
    if (!rule.is_active) continue

    // Check validity period
    if (rule.valid_from || rule.valid_to) {
      const flightDate = flight.date.toISOString().slice(0, 10)
      if (rule.valid_from && flightDate < rule.valid_from) continue
      if (rule.valid_to && flightDate > rule.valid_to) continue
    }

    // Does this aircraft match the rule's scope?
    if (!matchesScope(aircraft, rule)) continue

    // Does this flight match the rule's criteria?
    const flightMatches = matchesCriteria(flight, rule)

    // Apply action logic
    const violated = checkViolation(rule.action, flightMatches)

    if (violated) {
      const cost = rule.enforcement === 'hard' ? Infinity : (rule.penalty_cost || 3000)
      violations.push({
        ruleId: rule.id,
        ruleName: rule.name,
        enforcement: rule.enforcement,
        penaltyCost: cost,
        message: buildMessage(rule, aircraft),
      })
      if (rule.enforcement === 'soft') {
        totalPenalty += cost
      }
    }
  }

  const hasHardViolation = violations.some(v => v.enforcement === 'hard')

  return {
    allowed: !hasHardViolation,
    violations,
    totalPenalty,
  }
}

// ─── Scope matching ──────────────────────────────────────────

function matchesScope(ac: AircraftForEval, rule: ScheduleRule): boolean {
  switch (rule.scope_type) {
    case 'all': return true
    case 'type': return rule.scope_values.includes(ac.icaoType)
    case 'family': return ac.family !== null && rule.scope_values.includes(ac.family)
    case 'registration': return rule.scope_values.includes(ac.registration)
    default: return false
  }
}

// ─── Criteria matching ───────────────────────────────────────

function matchesCriteria(flight: FlightForEval, rule: ScheduleRule): boolean {
  const cv = rule.criteria_values || {}

  switch (rule.criteria_type) {
    case 'airports': {
      const airports: string[] = cv.airports || []
      const dir = cv.direction || 'any'
      if (dir === 'to') return airports.includes(flight.arrStation)
      if (dir === 'from') return airports.includes(flight.depStation)
      return airports.includes(flight.depStation) || airports.includes(flight.arrStation)
    }
    case 'routes': {
      const routes: string[] = cv.routes || []
      return routes.includes(`${flight.depStation}-${flight.arrStation}`)
    }
    case 'international': {
      const dc = AIRPORT_COUNTRY[flight.depStation]
      const ac = AIRPORT_COUNTRY[flight.arrStation]
      if (!dc || !ac) return false
      return dc !== ac
    }
    case 'domestic': {
      const dc = AIRPORT_COUNTRY[flight.depStation]
      const ac = AIRPORT_COUNTRY[flight.arrStation]
      if (!dc || !ac) return false
      return dc === ac && dc === OPERATOR_COUNTRY
    }
    case 'service_type': {
      return (cv.types || []).includes(flight.serviceType)
    }
    case 'departure_time': {
      const [fh, fm] = (cv.from || '00:00').split(':').map(Number)
      const [th, tm] = (cv.to || '23:59').split(':').map(Number)
      const fromMin = fh * 60 + fm
      const toMin = th * 60 + tm
      const std = flight.stdMinutes % 1440
      return fromMin <= toMin
        ? std >= fromMin && std <= toMin
        : std >= fromMin || std <= toMin
    }
    case 'block_time': {
      const mins = cv.minutes || 0
      switch (cv.operator || 'gt') {
        case 'gt': return flight.blockMinutes > mins
        case 'lt': return flight.blockMinutes < mins
        case 'gte': return flight.blockMinutes >= mins
        case 'lte': return flight.blockMinutes <= mins
        case 'eq': return flight.blockMinutes === mins
        default: return false
      }
    }
    case 'overnight': {
      return flight.staMinutes > 1440 || flight.staMinutes < flight.stdMinutes
    }
    case 'day_of_week': {
      const jsDay = flight.date.getDay()
      const isoDay = jsDay === 0 ? 7 : jsDay
      return (cv.days || []).includes(isoDay)
    }
    default: return false
  }
}

// ─── Action → violation check ─────────────────────────────────

function checkViolation(action: string, flightMatches: boolean): boolean {
  switch (action) {
    case 'must_not_fly':
    case 'should_avoid':
      // Violated when the flight DOES match the criteria
      return flightMatches

    case 'can_only_fly':
      // Violated when the flight does NOT match
      return !flightMatches

    case 'must_fly':
    case 'should_fly':
      // Positive rules — handled via bonus in evaluateBonus()
      return false

    default: return false
  }
}

// ─── Bonus evaluator for must_fly / should_fly ────────────────

/**
 * Returns a BONUS (positive number) if the aircraft is preferred
 * for this flight by must_fly/should_fly rules.
 */
export function evaluateBonus(
  flight: FlightForEval,
  aircraft: AircraftForEval,
  rules: ScheduleRule[]
): number {
  let bonus = 0

  for (const rule of rules) {
    if (!rule.is_active) continue
    if (rule.action !== 'must_fly' && rule.action !== 'should_fly') continue

    if (rule.valid_from || rule.valid_to) {
      const fd = flight.date.toISOString().slice(0, 10)
      if (rule.valid_from && fd < rule.valid_from) continue
      if (rule.valid_to && fd > rule.valid_to) continue
    }

    if (!matchesScope(aircraft, rule)) continue
    if (!matchesCriteria(flight, rule)) continue

    // This aircraft SHOULD/MUST fly this flight — give it a bonus
    if (rule.action === 'must_fly') {
      bonus += 50000  // Very strong pull
    } else {
      bonus += rule.penalty_cost || 3000  // Same scale as penalty
    }
  }

  return bonus
}

// ─── Human-readable violation message ─────────────────────────

function buildMessage(rule: ScheduleRule, ac: AircraftForEval): string {
  const actionLabels: Record<string, string> = {
    must_fly: 'must fly',
    should_fly: 'should fly',
    must_not_fly: 'must not fly',
    should_avoid: 'should avoid',
    can_only_fly: 'can only fly',
  }
  const name = rule.name || `${ac.registration} ${actionLabels[rule.action] || rule.action}`
  return `${name} (${rule.enforcement}, ${rule.enforcement === 'hard' ? 'blocked' : (rule.penalty_cost || 3000).toLocaleString() + ' pts'})`
}
