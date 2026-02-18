import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from '@/components/ui/visionos-toast'

// ─── Types ─────────────────────────────────────────────────────

export interface DragFlight {
  id: string           // expanded flight id (flightId_date)
  flightId: string     // underlying DB id
  aircraftTypeIcao: string | null
}

export interface DragState {
  /** The flight that the user grabbed */
  primaryFlightId: string
  /** All flights being dragged (includes multi-select) */
  draggedIds: Set<string>
  sourceReg: string
  isDragging: boolean
  /** Mouse Y in body-local coords */
  currentY: number
}

export type DropValidity = 'valid' | 'same-family' | 'invalid' | 'same-row' | 'group'

export interface PendingDrop {
  draggedIds: string[]    // expanded flight IDs (for dialog display)
  flightIds: string[]     // underlying DB flight IDs (for workspace overrides)
  sourceReg: string
  targetReg: string       // never null — overflow drops remain immediate
  targetIcao: string
  validity: 'valid' | 'same-family'
}

export interface RowHitInfo {
  type: 'aircraft' | 'overflow' | 'group'
  registration: string | null
  icaoType: string
  yTop: number
  validity: DropValidity
}

export interface UseMovementDragParams {
  selectedFlights: Set<string>
  /** Lookup: icao type → family */
  icaoToFamily: Map<string, string | null>
  /** Lookup: icao type → category */
  icaoToCategory: Map<string, string>
  /** Get the ICAO type for an expanded flight id */
  getFlightIcao: (expandedId: string) => string | null
  /** Get all route cycle mates for an expanded flight id */
  getRouteCycleMates: (expandedId: string) => string[]
  /** Are any modals open? */
  anyModalOpen: boolean
  /** Is clipboard active? */
  clipboardActive: boolean
}

export interface UseMovementDragReturn {
  workspaceOverrides: Map<string, string>
  dragState: DragState | null
  targetRow: RowHitInfo | null
  pendingDrop: PendingDrop | null
  /** Start drag sequence (called on mousedown on a bar) */
  onBarMouseDown: (expandedId: string, sourceReg: string, e: React.MouseEvent) => void
  /** Body-level mousemove for drag tracking */
  onBodyMouseMove: (bodyY: number, rows: RowLayoutItem[]) => void
  /** Body-level mouseup for drop */
  onBodyMouseUp: () => void
  /** Cancel drag (Escape) */
  cancelDrag: () => void
  /** Confirm pending drop */
  confirmDrop: () => void
  /** Cancel pending drop */
  cancelDrop: () => void
  /** Reset all workspace overrides */
  resetWorkspace: () => void
  /** Merge workspace overrides (used by clipboard paste) */
  addWorkspaceOverrides: (entries: [string, string][]) => void
  /** Remove workspace overrides for specific expanded flight IDs */
  removeWorkspaceOverrides: (expandedIds: string[]) => void
  /** Check if a flight is being dragged */
  isDragged: (expandedId: string) => boolean
  /** Check if a flight is a ghost placeholder (its original position while being dragged) */
  isGhostPlaceholder: (expandedId: string) => boolean
  /** Get the visual Y offset for a dragged bar (delta from original row) */
  getDragDeltaY: (originalRowY: number) => number
  /** Get workspace override reg for an expanded flight id (flightId_date) */
  getWorkspaceReg: (expandedId: string) => string | undefined
}

/** Minimal row layout info needed for hit-testing */
export interface RowLayoutItem {
  type: 'group' | 'aircraft' | 'overflow'
  icaoType: string
  registration: string | null  // null for group/overflow
  yTop: number
  height: number
}

// ─── Constants ─────────────────────────────────────────────────

const DRAG_DELAY_MS = 200

// ─── Hook ──────────────────────────────────────────────────────

export function useMovementDrag({
  selectedFlights,
  icaoToFamily,
  icaoToCategory,
  getFlightIcao,
  getRouteCycleMates,
  anyModalOpen,
  clipboardActive,
}: UseMovementDragParams): UseMovementDragReturn {
  const [workspaceOverrides, setWorkspaceOverrides] = useState<Map<string, string>>(new Map())
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [targetRow, setTargetRow] = useState<RowHitInfo | null>(null)
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null)

  // Refs for drag initiation timer
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingDragRef = useRef<{ expandedId: string; sourceReg: string } | null>(null)
  const dragStartedRef = useRef(false)

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (dragTimerRef.current) clearTimeout(dragTimerRef.current)
    }
  }, [])

  // ─── Drag initiation ─────────────────────────────────────────

  const onBarMouseDown = useCallback((expandedId: string, sourceReg: string, e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (anyModalOpen || clipboardActive || pendingDrop) return

    // Store pending drag info
    pendingDragRef.current = { expandedId, sourceReg }
    dragStartedRef.current = false

    // Set timer — if held 200ms, enter drag mode
    dragTimerRef.current = setTimeout(() => {
      if (!pendingDragRef.current) return
      dragStartedRef.current = true

      const { expandedId: eid, sourceReg: sReg } = pendingDragRef.current

      // Determine which flights to drag
      let draggedIds: Set<string>
      if (selectedFlights.has(eid) && selectedFlights.size > 1) {
        // Multi-drag: all selected flights
        draggedIds = new Set(selectedFlights)
      } else {
        // Single drag
        draggedIds = new Set([eid])
      }

      // Expand to include all route cycle mates
      const expanded = new Set<string>()
      Array.from(draggedIds).forEach(id => {
        getRouteCycleMates(id).forEach(m => expanded.add(m))
      })
      draggedIds = expanded

      setDragState({
        primaryFlightId: eid,
        draggedIds,
        sourceReg: sReg,
        isDragging: true,
        currentY: 0,
      })

      // Set cursor on body
      document.body.style.cursor = 'grabbing'
    }, DRAG_DELAY_MS)

    // Prevent text selection during potential drag
    e.preventDefault()
  }, [selectedFlights, anyModalOpen, clipboardActive, pendingDrop, getRouteCycleMates])

  // Cancel pending drag on mouseup before timer fires (= click)
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragTimerRef.current && !dragStartedRef.current) {
        clearTimeout(dragTimerRef.current)
        dragTimerRef.current = null
        pendingDragRef.current = null
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  // ─── Drop validity check ─────────────────────────────────────

  const checkDropValidity = useCallback((
    dragIcao: string | null,
    targetType: 'aircraft' | 'overflow' | 'group',
    targetIcao: string,
    targetReg: string | null,
    sourceReg: string
  ): DropValidity => {
    if (targetType === 'group') return 'group'
    if (targetReg === sourceReg) return 'same-row'

    if (!dragIcao) return 'valid' // unknown type, allow

    if (dragIcao === targetIcao) return 'valid'

    // Check family match
    const dragFamily = icaoToFamily.get(dragIcao)
    const targetFamily = icaoToFamily.get(targetIcao)
    if (dragFamily && targetFamily && dragFamily === targetFamily) return 'same-family'

    // Check category match — both narrowbody or both widebody etc
    const dragCat = icaoToCategory.get(dragIcao)
    const targetCat = icaoToCategory.get(targetIcao)
    if (dragCat && targetCat && dragCat !== targetCat) return 'invalid'

    return 'invalid'
  }, [icaoToFamily, icaoToCategory])

  // ─── Drag tracking ───────────────────────────────────────────

  const onBodyMouseMove = useCallback((bodyY: number, rows: RowLayoutItem[]) => {
    if (!dragState) return

    setDragState(prev => prev ? { ...prev, currentY: bodyY } : null)

    // Hit-test: which row is the cursor over?
    const dragIcao = getFlightIcao(dragState.primaryFlightId)

    for (const row of rows) {
      if (bodyY >= row.yTop && bodyY < row.yTop + row.height) {
        const validity = checkDropValidity(
          dragIcao,
          row.type,
          row.icaoType,
          row.registration,
          dragState.sourceReg
        )
        setTargetRow({
          type: row.type,
          registration: row.registration,
          icaoType: row.icaoType,
          yTop: row.yTop,
          validity,
        })
        return
      }
    }
    setTargetRow(null)
  }, [dragState, getFlightIcao, checkDropValidity])

  // ─── Drop ────────────────────────────────────────────────────

  const onBodyMouseUp = useCallback(() => {
    if (!dragState) return

    document.body.style.cursor = ''

    if (!targetRow || targetRow.validity === 'group') {
      // No valid target — cancel
      setDragState(null)
      setTargetRow(null)
      return
    }

    if (targetRow.validity === 'same-row') {
      // Dropped on same row — no change
      setDragState(null)
      setTargetRow(null)
      return
    }

    if (targetRow.validity === 'invalid') {
      // Invalid drop — rubber-band back
      const dragIcao = getFlightIcao(dragState.primaryFlightId) || '???'
      toast.error(`Cannot place ${dragIcao} flight on ${targetRow.icaoType} aircraft`, { duration: 2000 })
      setDragState(null)
      setTargetRow(null)
      return
    }

    // Valid drop (valid or same-family)
    const targetReg = targetRow.registration
    if (!targetReg) {
      // Overflow row — clear workspace override immediately (no dialog needed)
      setWorkspaceOverrides(prev => {
        const next = new Map(prev)
        Array.from(dragState.draggedIds).forEach(id => {
          next.delete(id) // key is expanded ID (flightId_date) — date-specific
        })
        return next
      })
      setDragState(null)
      setTargetRow(null)
    } else {
      // Non-overflow: show confirmation dialog
      const flightIds = Array.from(dragState.draggedIds).map(id =>
        id.includes('_') ? id.substring(0, id.lastIndexOf('_')) : id
      )
      setPendingDrop({
        draggedIds: Array.from(dragState.draggedIds),
        flightIds: Array.from(new Set(flightIds)),
        sourceReg: dragState.sourceReg,
        targetReg,
        targetIcao: targetRow.icaoType,
        validity: targetRow.validity as 'valid' | 'same-family',
      })
      // Keep dragState alive — bars stay visually "lifted" during dialog
      document.body.style.cursor = ''
      setTargetRow(null)
    }
  }, [dragState, targetRow, getFlightIcao])

  // ─── Confirm / Cancel drop ───────────────────────────────────

  const confirmDrop = useCallback(() => {
    if (!pendingDrop) return
    setWorkspaceOverrides(prev => {
      const next = new Map(prev)
      // Use draggedIds (expanded IDs with dates) so each date instance moves independently
      pendingDrop.draggedIds.forEach(eid => next.set(eid, pendingDrop.targetReg))
      return next
    })
    setPendingDrop(null)
    setDragState(null)
  }, [pendingDrop])

  const cancelDrop = useCallback(() => {
    setPendingDrop(null)
    setDragState(null)
  }, [])

  // ─── Cancel ──────────────────────────────────────────────────

  const cancelDrag = useCallback(() => {
    if (!dragState && !pendingDrop) return
    document.body.style.cursor = ''
    setPendingDrop(null)
    setDragState(null)
    setTargetRow(null)
  }, [dragState, pendingDrop])

  // Escape key cancels drag
  useEffect(() => {
    if (!dragState) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        cancelDrag()
      }
    }
    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [dragState, cancelDrag])

  // Right-click cancels drag
  useEffect(() => {
    if (!dragState) return
    const handler = () => {
      cancelDrag()
    }
    window.addEventListener('contextmenu', handler, { capture: true })
    return () => window.removeEventListener('contextmenu', handler, { capture: true })
  }, [dragState, cancelDrag])

  // ─── Reset workspace ─────────────────────────────────────────

  const resetWorkspace = useCallback(() => {
    setWorkspaceOverrides(new Map())
    toast.success('Layout reset to auto-assignment')
  }, [])

  // ─── Helpers ─────────────────────────────────────────────────

  const isDragged = useCallback((expandedId: string) => {
    return dragState?.draggedIds.has(expandedId) ?? false
  }, [dragState])

  const isGhostPlaceholder = useCallback((expandedId: string) => {
    // Ghost shows at original position when the flight is being dragged
    return dragState?.isDragging === true && dragState.draggedIds.has(expandedId)
  }, [dragState])

  const getDragDeltaY = useCallback((originalRowY: number) => {
    if (!dragState) return 0
    return dragState.currentY - originalRowY
  }, [dragState])

  const getWorkspaceReg = useCallback((expandedId: string) => {
    return workspaceOverrides.get(expandedId)
  }, [workspaceOverrides])

  const addWorkspaceOverrides = useCallback((entries: [string, string][]) => {
    setWorkspaceOverrides(prev => {
      const next = new Map(prev)
      for (const [k, v] of entries) next.set(k, v)
      return next
    })
  }, [])

  const removeWorkspaceOverrides = useCallback((expandedIds: string[]) => {
    setWorkspaceOverrides(prev => {
      if (prev.size === 0) return prev
      const next = new Map(prev)
      let changed = false
      for (const id of expandedIds) {
        if (next.delete(id)) changed = true
      }
      return changed ? next : prev
    })
  }, [])

  return {
    workspaceOverrides,
    dragState,
    targetRow,
    pendingDrop,
    onBarMouseDown,
    onBodyMouseMove,
    onBodyMouseUp,
    cancelDrag,
    confirmDrop,
    cancelDrop,
    resetWorkspace,
    addWorkspaceOverrides,
    removeWorkspaceOverrides,
    isDragged,
    isGhostPlaceholder,
    getDragDeltaY,
    getWorkspaceReg,
  }
}
