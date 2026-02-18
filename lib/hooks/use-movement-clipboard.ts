import { useState, useEffect, useCallback, useRef } from 'react'
import { getRoutesForFlights } from '@/app/actions/movement-control'
import { moveFullRoute, splitAndMoveRoute, copyFlights, undoPaste, type UndoPayload } from '@/app/actions/movement-paste'
import { classifyRouteSelection, type RouteAnalysis } from '@/lib/utils/route-analysis'
import { toast } from '@/components/ui/visionos-toast'
import { friendlyError } from '@/lib/utils/error-handler'

// ─── Types ─────────────────────────────────────────────────────

/** Minimal flight interface the hook needs (subset of ExpandedFlight) */
export interface ClipboardFlight {
  id: string
  flightId: string
  flightNumber: string
  depStation: string
  arrStation: string
  stdLocal: string
  staLocal: string
  blockMinutes: number
  status: string
  aircraftTypeIcao: string | null
  routeId: string | null
  aircraftReg: string | null
}

export interface ClipboardState {
  flights: ClipboardFlight[]
  flightIds: string[]       // deduplicated underlying DB IDs
  mode: 'cut' | 'copy'
  sourceRoutes: Map<string, RouteAnalysis>
  targetReg: string | null
}

export interface UndoState {
  description: string
  payload: UndoPayload
  timestamp: number
}

export interface UseMovementClipboardParams {
  selectedFlights: Set<string>
  selectedFlightObjects: ClipboardFlight[]
  refreshFlights: () => Promise<void>
  clearSelection: () => void
  /** All modals that should suppress keyboard shortcuts */
  anyModalOpen: boolean
}

export interface UseMovementClipboardReturn {
  clipboard: ClipboardState | null
  undo: UndoState | null
  pasteModalOpen: boolean
  setPasteModalOpen: (open: boolean) => void
  pasteTargetOpen: boolean
  setPasteTargetOpen: (open: boolean) => void
  justPastedIds: Set<string>
  isFlightGhosted: (expandedId: string, flightId: string) => boolean
  clearClipboard: () => void
  setTargetReg: (reg: string) => void
  executePaste: (options?: PasteOptions) => Promise<void>
  executeUndo: () => Promise<void>
  pasting: boolean
}

export interface PasteOptions {
  /** Override which leg sequences to move (for split cases) */
  movedLegSequences?: number[]
  /** Route ID for split operations */
  sourceRouteId?: string
}

// ─── Hook ──────────────────────────────────────────────────────

export function useMovementClipboard({
  selectedFlights,
  selectedFlightObjects,
  refreshFlights,
  clearSelection,
  anyModalOpen,
}: UseMovementClipboardParams): UseMovementClipboardReturn {
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [undoState, setUndoState] = useState<UndoState | null>(null)
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteTargetOpen, setPasteTargetOpen] = useState(false)
  const [justPastedIds, setJustPastedIds] = useState<Set<string>>(new Set())
  const [pasting, setPasting] = useState(false)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear undo after 10s
  const setUndoWithTimer = useCallback((undo: UndoState | null) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    setUndoState(undo)
    if (undo) {
      undoTimerRef.current = setTimeout(() => {
        setUndoState(null)
      }, 10_000)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    }
  }, [])

  // ─── Cut / Copy ──────────────────────────────────────────────

  const initClipboard = useCallback(async (mode: 'cut' | 'copy') => {
    if (selectedFlights.size === 0) return

    const flights = [...selectedFlightObjects]
    // Deduplicate by flightId (one scheduled_flight can appear on multiple dates)
    const seen = new Set<string>()
    const flightIds: string[] = []
    for (const f of flights) {
      if (!seen.has(f.flightId)) {
        seen.add(f.flightId)
        flightIds.push(f.flightId)
      }
    }

    // Fetch route data for these flights
    const sourceRoutes = new Map<string, RouteAnalysis>()
    try {
      const routeDataList = await getRoutesForFlights(flightIds)
      const flightIdSet = new Set(flightIds)
      for (const rd of routeDataList) {
        const analysis = classifyRouteSelection(rd, flightIdSet)
        sourceRoutes.set(rd.id, analysis)
      }
    } catch {
      // Non-fatal: flights may not be in any route
    }

    setClipboard({
      flights,
      flightIds,
      mode,
      sourceRoutes,
      targetReg: null,
    })

    if (mode === 'cut') {
      toast.success(`${flightIds.length} flight${flightIds.length > 1 ? 's' : ''} cut`)
    } else {
      toast.success(`${flightIds.length} flight${flightIds.length > 1 ? 's' : ''} copied`)
    }
  }, [selectedFlights, selectedFlightObjects])

  // ─── Set Target ──────────────────────────────────────────────

  const setTargetReg = useCallback((reg: string) => {
    if (!clipboard) return
    setClipboard({ ...clipboard, targetReg: reg })
  }, [clipboard])

  // ─── Clear ───────────────────────────────────────────────────

  const clearClipboard = useCallback(() => {
    setClipboard(null)
    setPasteModalOpen(false)
    setPasteTargetOpen(false)
  }, [])

  // ─── Ghost check ─────────────────────────────────────────────

  const isFlightGhosted = useCallback((expandedId: string, flightId: string) => {
    if (!clipboard || clipboard.mode !== 'cut') return false
    return clipboard.flightIds.includes(flightId)
  }, [clipboard])

  // ─── Execute Paste ───────────────────────────────────────────

  const executePaste = useCallback(async (options?: PasteOptions) => {
    if (!clipboard || !clipboard.targetReg) return
    setPasting(true)

    try {
      const { mode, flightIds, targetReg, sourceRoutes } = clipboard

      if (mode === 'copy') {
        // For copy, determine if flights are from a single route
        const routeEntries = Array.from(sourceRoutes.values())
        const sourceRouteId = routeEntries.length === 1 ? routeEntries[0].routeId : null
        const res = await copyFlights(flightIds, targetReg!, sourceRouteId)
        if (res.error) { toast.error(friendlyError(res.error)); return }

        // Set just-pasted for animation
        if (res.undoPayload?.type === 'delete_copies') {
          setJustPastedIds(new Set(res.undoPayload.newFlightIds))
          setTimeout(() => setJustPastedIds(new Set()), 1500)
        }

        setUndoWithTimer({
          description: `Copied ${flightIds.length} flight${flightIds.length > 1 ? 's' : ''} to ${targetReg}`,
          payload: res.undoPayload!,
          timestamp: Date.now(),
        })
        toast.success(`${flightIds.length} flight${flightIds.length > 1 ? 's' : ''} copied to ${targetReg}`)
      } else {
        // Cut mode — check if we need to split
        if (options?.movedLegSequences && options?.sourceRouteId) {
          // Split operation
          const res = await splitAndMoveRoute(options.sourceRouteId, options.movedLegSequences, targetReg!)
          if (res.error) { toast.error(friendlyError(res.error)); return }

          setJustPastedIds(new Set(flightIds))
          setTimeout(() => setJustPastedIds(new Set()), 1500)

          setUndoWithTimer({
            description: `Split & moved ${options.movedLegSequences.length} leg${options.movedLegSequences.length > 1 ? 's' : ''} to ${targetReg}`,
            payload: res.undoPayload!,
            timestamp: Date.now(),
          })
          toast.success(`Split & moved to ${targetReg}`)
        } else {
          // Full move
          const res = await moveFullRoute(flightIds, targetReg!)
          if (res.error) { toast.error(friendlyError(res.error)); return }

          setJustPastedIds(new Set(flightIds))
          setTimeout(() => setJustPastedIds(new Set()), 1500)

          setUndoWithTimer({
            description: `Moved ${flightIds.length} flight${flightIds.length > 1 ? 's' : ''} to ${targetReg}`,
            payload: res.undoPayload!,
            timestamp: Date.now(),
          })
          toast.success(`${flightIds.length} flight${flightIds.length > 1 ? 's' : ''} moved to ${targetReg}`)
        }
      }

      // Clean up
      setClipboard(null)
      setPasteModalOpen(false)
      clearSelection()
      await refreshFlights()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Paste failed')
    } finally {
      setPasting(false)
    }
  }, [clipboard, refreshFlights, clearSelection, setUndoWithTimer])

  // ─── Execute Undo ────────────────────────────────────────────

  const executeUndo = useCallback(async () => {
    if (!undoState) return

    const res = await undoPaste(undoState.payload)
    if (res.error) {
      toast.error(friendlyError(res.error))
      return
    }

    toast.success('Paste undone')
    setUndoState(null)
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
    await refreshFlights()
  }, [undoState, refreshFlights])

  // ─── Keyboard Handler ────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Guard: skip if target is an input element
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (anyModalOpen || pasteModalOpen || pasteTargetOpen) return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+X: Cut
      if (ctrl && e.key === 'x') {
        if (selectedFlights.size > 0) {
          e.preventDefault()
          initClipboard('cut')
        }
        return
      }

      // Ctrl+C: Copy
      if (ctrl && e.key === 'c') {
        if (selectedFlights.size > 0) {
          e.preventDefault()
          initClipboard('copy')
        }
        return
      }

      // Ctrl+V: Paste
      if (ctrl && e.key === 'v') {
        if (!clipboard) return
        e.preventDefault()
        if (!clipboard.targetReg) {
          setPasteTargetOpen(true)
        } else {
          setPasteModalOpen(true)
        }
        return
      }

      // Ctrl+Z: Undo
      if (ctrl && e.key === 'z') {
        if (undoState && Date.now() - undoState.timestamp < 10_000) {
          e.preventDefault()
          executeUndo()
        }
        return
      }

      // Escape: clear clipboard first, then fall through
      if (e.key === 'Escape') {
        if (clipboard) {
          e.preventDefault()
          e.stopPropagation()
          clearClipboard()
          return
        }
        // Let existing Escape handler in gantt-chart handle selection clearing
      }
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [
    selectedFlights.size, clipboard, undoState, anyModalOpen,
    initClipboard, clearClipboard, executeUndo,
  ])

  return {
    clipboard,
    undo: undoState,
    pasteModalOpen,
    setPasteModalOpen,
    pasteTargetOpen,
    setPasteTargetOpen,
    justPastedIds,
    isFlightGhosted,
    clearClipboard,
    setTargetReg,
    executePaste,
    executeUndo,
    pasting,
  }
}
