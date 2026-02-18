import { useState, useEffect, useCallback } from 'react'
import { toast } from '@/components/ui/visionos-toast'

// ─── Types ─────────────────────────────────────────────────────

export interface ClipboardState {
  expandedIds: Set<string>   // date-specific: uuid_YYYY-MM-DD
  targetReg: string | null
}

export interface UseGanttClipboardParams {
  selectedFlights: Set<string>
  clearSelection: () => void
  /** All modals that should suppress keyboard shortcuts */
  anyModalOpen: boolean
  /** Called when Ctrl+A is pressed with flights selected */
  onAssign?: () => void
  /** Called to execute paste: sets workspace overrides */
  onPaste: (expandedIds: string[], targetReg: string) => void
}

export interface UseGanttClipboardReturn {
  clipboard: ClipboardState | null
  justPastedIds: Set<string>
  isFlightGhosted: (expandedId: string) => boolean
  clearClipboard: () => void
  setTargetReg: (reg: string) => void
  pasteToTarget: (targetReg: string) => void
}

// ─── Hook ──────────────────────────────────────────────────────

export function useGanttClipboard({
  selectedFlights,
  clearSelection,
  anyModalOpen,
  onAssign,
  onPaste,
}: UseGanttClipboardParams): UseGanttClipboardReturn {
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null)
  const [justPastedIds, setJustPastedIds] = useState<Set<string>>(new Set())

  // ─── Cut ────────────────────────────────────────────────────

  const initClipboard = useCallback(() => {
    if (selectedFlights.size === 0) return
    const expandedIds = new Set(selectedFlights)
    setClipboard({ expandedIds, targetReg: null })
    const count = expandedIds.size
    toast.success(`${count} flight${count > 1 ? 's' : ''} cut`)
  }, [selectedFlights])

  // ─── Set Target ──────────────────────────────────────────────

  const setTargetReg = useCallback((reg: string) => {
    if (!clipboard) return
    setClipboard({ ...clipboard, targetReg: reg })
  }, [clipboard])

  // ─── Clear ───────────────────────────────────────────────────

  const clearClipboard = useCallback(() => {
    setClipboard(null)
  }, [])

  // ─── Ghost check ─────────────────────────────────────────────

  const isFlightGhosted = useCallback((expandedId: string) => {
    if (!clipboard) return false
    return clipboard.expandedIds.has(expandedId)
  }, [clipboard])

  // ─── Paste ───────────────────────────────────────────────────

  const pasteToTarget = useCallback((targetReg: string) => {
    if (!clipboard) return
    onPaste(Array.from(clipboard.expandedIds), targetReg)
    const count = clipboard.expandedIds.size
    setJustPastedIds(new Set(clipboard.expandedIds))
    setTimeout(() => setJustPastedIds(new Set()), 1500)
    toast.success(`${count} flight${count > 1 ? 's' : ''} moved to ${targetReg}`)
    setClipboard(null)
    clearSelection()
  }, [clipboard, onPaste, clearSelection])

  // ─── Keyboard Handler ────────────────────────────────────────

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (anyModalOpen) return

      const ctrl = e.ctrlKey || e.metaKey

      // Ctrl+X: Cut
      if (ctrl && e.key === 'x') {
        if (selectedFlights.size > 0) {
          e.preventDefault()
          initClipboard()
        }
        return
      }

      // Ctrl+V: Paste
      if (ctrl && e.key === 'v') {
        if (clipboard?.targetReg) {
          e.preventDefault()
          pasteToTarget(clipboard.targetReg)
        }
        return
      }

      // Ctrl+A: Assign to aircraft
      if (ctrl && e.key === 'a') {
        if (selectedFlights.size > 0 && onAssign) {
          e.preventDefault()
          onAssign()
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
      }
    }

    window.addEventListener('keydown', handler, { capture: true })
    return () => window.removeEventListener('keydown', handler, { capture: true })
  }, [
    selectedFlights.size, clipboard, anyModalOpen,
    initClipboard, clearClipboard, pasteToTarget, onAssign,
  ])

  return {
    clipboard,
    justPastedIds,
    isFlightGhosted,
    clearClipboard,
    setTargetReg,
    pasteToTarget,
  }
}
