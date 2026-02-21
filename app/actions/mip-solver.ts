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
  tatMinutes: Record<string, number>           // scheduled TAT per type
  tatMinMinutes?: Record<string, number>       // minimum TAT per type (soft)
  tatHardFloorMinutes?: Record<string, number> // hard floor per type
  timeLimitSec: number
  mipGap: number
  allowFamilySub: boolean
  familyMap: Record<string, string>
  chainBreakCost?: number
  overflowCost?: number
  tightTatPenalty?: number
  softTatPenalty?: number
  chainContinuity?: 'strict' | 'flexible'
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

// ─── Solve (CG solver handles rolling horizon internally) ────────────

export async function solveMIP(
  payload: MIPSolveRequest
): Promise<MIPSolveResponse> {
  if (!MIP_SOLVER_URL) {
    return makeErrorResponse(payload.flights, 'MIP_SOLVER_URL not configured')
  }

  try {
    // 10 minute timeout — server manages its own time budget
    const timeoutMs = 10 * 60 * 1000

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
        ? `Solver timed out after 10 minutes`
        : (err?.message || 'Failed to reach solver'),
    )
  }
}
