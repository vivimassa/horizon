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

// ─── Server action ───────────────────────────────────────────────────

export async function solveMIP(
  payload: MIPSolveRequest
): Promise<MIPSolveResponse> {
  if (!MIP_SOLVER_URL) {
    return {
      status: 'Error',
      assignments: {},
      overflow: payload.flights.map(f => f.id),
      chainBreaks: [],
      objectiveValue: 0,
      totalVariables: 0,
      totalConstraints: 0,
      elapsedMs: 0,
      message: 'MIP_SOLVER_URL not configured in environment',
    }
  }

  try {
    const timeoutMs = (payload.timeLimitSec + 60) * 1000

    const res = await fetch(`${MIP_SOLVER_URL}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) {
      const text = await res.text()
      return {
        status: 'Error',
        assignments: {},
        overflow: payload.flights.map(f => f.id),
        chainBreaks: [],
        objectiveValue: 0,
        totalVariables: 0,
        totalConstraints: 0,
        elapsedMs: 0,
        message: `Solver returned HTTP ${res.status}: ${text}`,
      }
    }

    const data = await res.json()
    return data as MIPSolveResponse
  } catch (err: any) {
    return {
      status: 'Error',
      assignments: {},
      overflow: payload.flights.map(f => f.id),
      chainBreaks: [],
      objectiveValue: 0,
      totalVariables: 0,
      totalConstraints: 0,
      elapsedMs: 0,
      message: err?.name === 'TimeoutError'
        ? `Solver timed out after ${payload.timeLimitSec + 60}s`
        : (err?.message || 'Failed to reach solver'),
    }
  }
}
