// ─── Swap Validation ─────────────────────────────────────────────────────
// Pure functions to validate a flight swap between two aircraft registrations.

export interface SwapFlight {
  id: string
  flightId: string
  depStation: string
  arrStation: string
  stdMinutes: number
  staMinutes: number
  blockMinutes: number
  date: Date
  aircraftTypeIcao: string | null
  routeType: string | null
}

export type SwapWarningSeverity = 'ok' | 'warning' | 'error'
export type SwapWarningType = 'chain-break' | 'time-overlap' | 'tat-insufficient' | 'ac-type-mismatch'

export interface SwapWarning {
  side: 'A' | 'B'
  reg: string
  type: SwapWarningType
  severity: SwapWarningSeverity
  message: string
}

/**
 * Validate a swap of flights between two aircraft registrations.
 * Returns a list of warnings/errors for the hypothetical post-swap state.
 */
export function validateSwap(
  sideA: SwapFlight[], regA: string, acTypeA: string,
  sideB: SwapFlight[], regB: string, acTypeB: string,
  rowAFlights: SwapFlight[],
  rowBFlights: SwapFlight[],
  tatMinutes: Map<string, number>,
): SwapWarning[] {
  const warnings: SwapWarning[] = []

  // AC type compatibility
  if (acTypeA !== acTypeB) {
    // Different types — check if same family (warning) vs different category (error)
    const familyA = extractFamily(acTypeA)
    const familyB = extractFamily(acTypeB)
    if (familyA && familyB && familyA === familyB) {
      warnings.push({ side: 'A', reg: regB, type: 'ac-type-mismatch', severity: 'warning', message: `${acTypeA} flights moving to ${acTypeB} aircraft (same family)` })
    } else {
      warnings.push({ side: 'A', reg: regB, type: 'ac-type-mismatch', severity: 'error', message: `${acTypeA} flights moving to ${acTypeB} aircraft (different type)` })
    }
  }

  // Validate side A flights going to regB row
  const rowBAfterSwap = buildPostSwapRow(rowBFlights, sideB, sideA)
  validateSide(rowBAfterSwap, sideA, 'A', regB, tatMinutes, warnings)

  // Validate side B flights going to regA row
  const rowAAfterSwap = buildPostSwapRow(rowAFlights, sideA, sideB)
  validateSide(rowAAfterSwap, sideB, 'B', regA, tatMinutes, warnings)

  // If no warnings at all, add an "ok" indicator
  if (warnings.length === 0) {
    warnings.push({ side: 'A', reg: regB, type: 'chain-break', severity: 'ok', message: 'Swap looks clean — no conflicts detected' })
  }

  return warnings
}

/** Build the post-swap flight list for a row: remove outgoing, add incoming */
function buildPostSwapRow(rowFlights: SwapFlight[], remove: SwapFlight[], add: SwapFlight[]): SwapFlight[] {
  const removeIds = new Set(remove.map(f => f.id))
  const remaining = rowFlights.filter(f => !removeIds.has(f.id))
  return [...remaining, ...add].sort((a, b) => {
    const dd = a.date.getTime() - b.date.getTime()
    return dd !== 0 ? dd : a.stdMinutes - b.stdMinutes
  })
}

/** Validate one side of the swap (incoming flights on target row) */
function validateSide(
  fullRow: SwapFlight[],
  incoming: SwapFlight[],
  side: 'A' | 'B',
  targetReg: string,
  tatMinutes: Map<string, number>,
  warnings: SwapWarning[],
) {
  const incomingIds = new Set(incoming.map(f => f.id))

  for (let i = 0; i < fullRow.length; i++) {
    const curr = fullRow[i]
    const next = i + 1 < fullRow.length ? fullRow[i + 1] : null

    if (!next) continue
    // Only check transitions involving incoming flights
    if (!incomingIds.has(curr.id) && !incomingIds.has(next.id)) continue

    const sameDay = curr.date.getTime() === next.date.getTime()

    // Time overlap check
    if (sameDay && curr.staMinutes > next.stdMinutes) {
      warnings.push({
        side, reg: targetReg,
        type: 'time-overlap',
        severity: 'error',
        message: `Time overlap on ${targetReg}: flight ending at ${fmtMin(curr.staMinutes)} overlaps with departure at ${fmtMin(next.stdMinutes)}`,
      })
      continue // skip TAT/chain checks for overlapping pair
    }

    // Station chain continuity
    if (sameDay && curr.arrStation !== next.depStation) {
      warnings.push({
        side, reg: targetReg,
        type: 'chain-break',
        severity: 'warning',
        message: `Chain break on ${targetReg}: arrives ${curr.arrStation}, next departs ${next.depStation}`,
      })
    }

    // TAT sufficiency
    if (sameDay) {
      const gap = next.stdMinutes - curr.staMinutes
      const minTat = tatMinutes.get(targetReg) ?? 45
      if (gap >= 0 && gap < minTat) {
        warnings.push({
          side, reg: targetReg,
          type: 'tat-insufficient',
          severity: 'warning',
          message: `Tight turnaround on ${targetReg}: ${gap}min gap (min ${minTat}min)`,
        })
      }
    }
  }
}

/** Extract a pseudo-family from ICAO type code (e.g. A320 → A32, B738 → B73) */
function extractFamily(icao: string): string | null {
  if (!icao || icao.length < 3) return null
  return icao.slice(0, 3)
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}
