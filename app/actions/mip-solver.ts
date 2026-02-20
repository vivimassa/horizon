'use server'

const MIP_SOLVER_URL = process.env.MIP_SOLVER_URL

// ─── Request / Response types ────────────────────────────────────────

export interface MIPSolveRequest {
  flights: {
    id: string
    depStation: string
    arrStation: string
    startMs: number
    endMs: number
    icaoType: string
    pinned: boolean
    pinnedReg: string | null
    routeType: string | null
  }[]
  aircraft: {
    index: number
    registration: string
    icaoType: string
    family: string | null
  }[]
  tatMinutes: Record<string, number>
  timeLimitSec: number
  mipGap: number
  allowFamilySub: boolean
  familyMap: Record<string, string>
  chainBreakCost?: number
  overflowCost?: number
}

export interface MIPSolveResponse {
  status: 'Optimal' | 'Feasible' | 'Infeasible' | 'Error'
  assignments: Record<string, string>
  overflow: string[]
  chainBreaks: { flightId: string; prevArr: string; nextDep: string }[]
  objectiveValue: number
  totalVariables: number
  totalConstraints: number
  elapsedMs: number
  message?: string
}

export interface MIPRollingResponse extends MIPSolveResponse {
  daysProcessed: number
  dayResults: {
    day: number
    flights: number
    assigned: number
    overflow: number
    chainBreaks: number
    status: string
    elapsedMs: number
  }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────

function makeErrorResponse(flights: MIPSolveRequest['flights'], message: string): MIPSolveResponse {
  return {
    status: 'Error',
    assignments: {},
    overflow: flights.map(f => f.id),
    chainBreaks: [],
    objectiveValue: 0,
    totalVariables: 0,
    totalConstraints: 0,
    elapsedMs: 0,
    message,
  }
}

// ─── Single solve (≤3 days or small fleet) ───────────────────────────

export async function solveMIP(
  payload: MIPSolveRequest
): Promise<MIPSolveResponse> {
  if (!MIP_SOLVER_URL) {
    return makeErrorResponse(payload.flights, 'MIP_SOLVER_URL not configured')
  }

  try {
    const timeoutMs = 10 * 60 * 1000  // 10 minutes — server manages its own time budget

    const res = await fetch(`${MIP_SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const text = await res.text()
      return makeErrorResponse(payload.flights, `Solver HTTP ${res.status}: ${text}`)
    }

    return await res.json() as MIPSolveResponse
  } catch (err: any) {
    return makeErrorResponse(
      payload.flights,
      err?.name === 'TimeoutError'
        ? `Solver timed out after ${payload.timeLimitSec + 60}s`
        : (err?.message || 'Failed to reach solver'),
    )
  }
}

// ─── Rolling horizon (>3 days) ───────────────────────────────────────

export async function solveMIPRolling(
  payload: MIPSolveRequest
): Promise<MIPRollingResponse> {
  if (!MIP_SOLVER_URL) {
    return {
      ...makeErrorResponse(payload.flights, 'MIP_SOLVER_URL not configured'),
      daysProcessed: 0,
      dayResults: [],
    }
  }

  try {
    // Rolling endpoint uses timeLimitSecPerDay instead of timeLimitSec
    const rollingPayload = {
      flights: payload.flights,
      aircraft: payload.aircraft,
      tatMinutes: payload.tatMinutes,
      timeLimitSecPerDay: Math.max(payload.timeLimitSec / 3, 10), // split budget
      mipGap: payload.mipGap,
      allowFamilySub: payload.allowFamilySub,
      familyMap: payload.familyMap,
      chainBreakCost: payload.chainBreakCost ?? 5000,
      overflowCost: payload.overflowCost ?? 50000,
    }

    // Generous timeout for multi-day
    const numDays = new Set(payload.flights.map(f => Math.floor(f.startMs / (24 * 3600 * 1000)))).size
    const timeoutMs = Math.max(numDays * payload.timeLimitSec * 1000, 120000) + 60000

    const res = await fetch(`${MIP_SOLVER_URL}/solve-rolling`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rollingPayload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const text = await res.text()
      return {
        ...makeErrorResponse(payload.flights, `Rolling solver HTTP ${res.status}: ${text}`),
        daysProcessed: 0,
        dayResults: [],
      }
    }

    return await res.json() as MIPRollingResponse
  } catch (err: any) {
    return {
      ...makeErrorResponse(
        payload.flights,
        err?.name === 'TimeoutError'
          ? `Rolling solver timed out`
          : (err?.message || 'Failed to reach solver'),
      ),
      daysProcessed: 0,
      dayResults: [],
    }
  }
}

// ─── Auto-select: single vs rolling based on period length ───────────

export async function solveMIPAuto(
  payload: MIPSolveRequest
): Promise<MIPSolveResponse | MIPRollingResponse> {
  // Count distinct days
  const days = new Set(
    payload.flights.map(f => Math.floor(f.startMs / (24 * 3600 * 1000)))
  )

  // Use rolling horizon for periods > 3 days
  if (days.size > 3) {
    return solveMIPRolling(payload)
  }

  return solveMIP(payload)
}
