import type { GanttRouteData } from '@/app/actions/gantt'

// ─── Types ─────────────────────────────────────────────────────

export type RouteClassification =
  | 'FULL_ROUTE'
  | 'TAIL_SPLIT'
  | 'HEAD_SPLIT'
  | 'MIDDLE_EXTRACT'
  | 'SCATTERED'
  | 'NO_ROUTE'

export interface RouteAnalysis {
  routeId: string
  routeData: GanttRouteData
  classification: RouteClassification
  selectedLegSequences: number[]
  allLegSequences: number[]
  isFullRoute: boolean
}

// ─── Classification ────────────────────────────────────────────

/**
 * Classify how a set of selected flights relates to a route's leg structure.
 * Determines if the selection is a full route, a head/tail/middle split, or scattered.
 */
export function classifyRouteSelection(
  routeData: GanttRouteData,
  selectedFlightIds: Set<string>
): RouteAnalysis {
  const allSeqs = routeData.legs.map(l => l.legSequence)
  const selectedSeqs = routeData.legs
    .filter(l => l.flightId && selectedFlightIds.has(l.flightId))
    .map(l => l.legSequence)
    .sort((a, b) => a - b)

  if (selectedSeqs.length === 0) {
    return {
      routeId: routeData.id,
      routeData,
      classification: 'NO_ROUTE',
      selectedLegSequences: [],
      allLegSequences: allSeqs,
      isFullRoute: false,
    }
  }

  const isFullRoute = selectedSeqs.length === allSeqs.length
  if (isFullRoute) {
    return {
      routeId: routeData.id,
      routeData,
      classification: 'FULL_ROUTE',
      selectedLegSequences: selectedSeqs,
      allLegSequences: allSeqs,
      isFullRoute: true,
    }
  }

  // Check contiguity
  const isContiguous = selectedSeqs.every(
    (seq, i) => i === 0 || seq === selectedSeqs[i - 1] + 1
  )

  let classification: RouteClassification

  if (!isContiguous) {
    classification = 'SCATTERED'
  } else {
    const minSeq = selectedSeqs[0]
    const maxSeq = selectedSeqs[selectedSeqs.length - 1]
    const allMin = Math.min(...allSeqs)
    const allMax = Math.max(...allSeqs)

    if (minSeq === allMin) {
      // Starts from the beginning → HEAD_SPLIT (selecting leading legs)
      classification = 'HEAD_SPLIT'
    } else if (maxSeq === allMax) {
      // Goes to the end → TAIL_SPLIT (selecting trailing legs)
      classification = 'TAIL_SPLIT'
    } else {
      classification = 'MIDDLE_EXTRACT'
    }
  }

  return {
    routeId: routeData.id,
    routeData,
    classification,
    selectedLegSequences: selectedSeqs,
    allLegSequences: allSeqs,
    isFullRoute: false,
  }
}

// ─── Recommended Action ────────────────────────────────────────

export interface RecommendedOption {
  label: string
  description: string
  /** Which leg sequences would actually be moved */
  movedSequences: number[]
}

/**
 * Return the smart suggestion for a given classification.
 * For MIDDLE_EXTRACT, recommend moving selected + all legs after them.
 * For SCATTERED, recommend the contiguous block covering the selection.
 */
export function getRecommendedOption(
  classification: RouteClassification,
  allSeqs: number[],
  selectedSeqs: number[]
): RecommendedOption | null {
  if (classification === 'FULL_ROUTE' || classification === 'NO_ROUTE') {
    return null
  }

  if (classification === 'MIDDLE_EXTRACT') {
    // Recommend moving selected + trailing
    const minSelected = Math.min(...selectedSeqs)
    const movedSequences = allSeqs.filter(s => s >= minSelected)
    return {
      label: 'Move selected + trailing legs',
      description: `Move leg ${minSelected} onward (${movedSequences.length} legs) — fewest chain breaks`,
      movedSequences,
    }
  }

  if (classification === 'SCATTERED') {
    // Recommend the contiguous block spanning min→max of selection
    const minSelected = Math.min(...selectedSeqs)
    const maxSelected = Math.max(...selectedSeqs)
    const movedSequences = allSeqs.filter(s => s >= minSelected && s <= maxSelected)
    return {
      label: 'Move contiguous block',
      description: `Move legs ${minSelected}–${maxSelected} (${movedSequences.length} legs)`,
      movedSequences,
    }
  }

  // TAIL_SPLIT or HEAD_SPLIT — the selection itself is the recommended option
  return {
    label: classification === 'TAIL_SPLIT' ? 'Split trailing legs' : 'Split leading legs',
    description: `Move ${selectedSeqs.length} leg${selectedSeqs.length > 1 ? 's' : ''}`,
    movedSequences: selectedSeqs,
  }
}
