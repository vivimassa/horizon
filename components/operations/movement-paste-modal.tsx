'use client'

import { useState, useMemo } from 'react'
import { Scissors, Copy, AlertTriangle, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { ClipboardState, PasteOptions } from '@/lib/hooks/use-movement-clipboard'
import type { RouteAnalysis } from '@/lib/utils/route-analysis'
import { getRecommendedOption } from '@/lib/utils/route-analysis'

interface MovementPasteModalProps {
  open: boolean
  onClose: () => void
  clipboard: ClipboardState
  onPaste: (options?: PasteOptions) => Promise<void>
  pasting: boolean
}

export function MovementPasteModal({
  open, onClose, clipboard, onPaste, pasting,
}: MovementPasteModalProps) {
  const { flights, flightIds, mode, sourceRoutes, targetReg } = clipboard

  // Determine the primary route analysis (first route if any)
  const routeAnalyses = useMemo(() => Array.from(sourceRoutes.values()), [sourceRoutes])
  const primaryAnalysis = routeAnalyses.length === 1 ? routeAnalyses[0] : null
  const classification = primaryAnalysis?.classification || 'NO_ROUTE'

  // For split cases, track user's radio selection
  const [splitChoice, setSplitChoice] = useState<'selected' | 'recommended' | 'full'>('recommended')

  const recommended = useMemo(() => {
    if (!primaryAnalysis) return null
    return getRecommendedOption(
      primaryAnalysis.classification,
      primaryAnalysis.allLegSequences,
      primaryAnalysis.selectedLegSequences
    )
  }, [primaryAnalysis])

  // Build paste options based on choice
  const buildPasteOptions = (): PasteOptions | undefined => {
    if (!primaryAnalysis) return undefined
    const c = primaryAnalysis.classification

    if (c === 'FULL_ROUTE' || c === 'NO_ROUTE') return undefined

    if (splitChoice === 'full') return undefined // move everything (no split)

    if (splitChoice === 'recommended' && recommended) {
      return {
        movedLegSequences: recommended.movedSequences,
        sourceRouteId: primaryAnalysis.routeId,
      }
    }

    // 'selected' — move only selected legs
    return {
      movedLegSequences: primaryAnalysis.selectedLegSequences,
      sourceRouteId: primaryAnalysis.routeId,
    }
  }

  const handlePaste = async () => {
    await onPaste(buildPasteOptions())
  }

  // Describe what will happen
  const actionLabel = mode === 'cut'
    ? (classification === 'FULL_ROUTE' || classification === 'NO_ROUTE'
      ? `Move ${flightIds.length} Flight${flightIds.length > 1 ? 's' : ''}`
      : splitChoice === 'full'
        ? `Move Entire Route`
        : 'Split & Move')
    : `Paste ${flightIds.length} Flight${flightIds.length > 1 ? 's' : ''}`

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden" style={{
        background: 'var(--glass-bg-heavy)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--glass-border-heavy)',
      }}>
        {/* Header */}
        <div className="px-4 py-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            {mode === 'cut'
              ? <Scissors className="h-4 w-4" />
              : <Copy className="h-4 w-4" />
            }
            {mode === 'cut' ? 'Move Flights' : 'Paste Copied Flights'}
          </DialogTitle>
        </div>

        {/* Summary */}
        <div className="px-4 py-3 border-b bg-muted/20 space-y-1.5">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="font-medium">
              {flightIds.length} flight{flightIds.length > 1 ? 's' : ''}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className="font-semibold text-primary">{targetReg}</span>
          </div>

          {/* Flight list */}
          <div className="max-h-[120px] overflow-y-auto space-y-0.5">
            {flights.slice(0, 10).map(f => (
              <div key={f.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-medium text-foreground">{f.flightNumber}</span>
                <span>{f.depStation} → {f.arrStation}</span>
                <span>{f.stdLocal}-{f.staLocal}</span>
              </div>
            ))}
            {flights.length > 10 && (
              <div className="text-[10px] text-muted-foreground/70">
                ...and {flights.length - 10} more
              </div>
            )}
          </div>
        </div>

        {/* Route-specific content */}
        <div className="px-4 py-3">
          {/* Case 1: FULL_ROUTE or NO_ROUTE */}
          {(classification === 'FULL_ROUTE' || classification === 'NO_ROUTE') && (
            <FullRouteView
              classification={classification}
              analysis={primaryAnalysis}
              flightCount={flightIds.length}
            />
          )}

          {/* Case 2: TAIL_SPLIT or HEAD_SPLIT */}
          {(classification === 'TAIL_SPLIT' || classification === 'HEAD_SPLIT') && primaryAnalysis && (
            <SplitView
              analysis={primaryAnalysis}
            />
          )}

          {/* Case 3: MIDDLE_EXTRACT */}
          {classification === 'MIDDLE_EXTRACT' && primaryAnalysis && (
            <MiddleExtractView
              analysis={primaryAnalysis}
              recommended={recommended}
              splitChoice={splitChoice}
              onChoiceChange={setSplitChoice}
            />
          )}

          {/* Case 4: SCATTERED */}
          {classification === 'SCATTERED' && primaryAnalysis && (
            <ScatteredView
              analysis={primaryAnalysis}
              recommended={recommended}
              splitChoice={splitChoice}
              onChoiceChange={setSplitChoice}
            />
          )}

          {/* Multi-route warning */}
          {routeAnalyses.length > 1 && (
            <div className="flex items-start gap-2 mt-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[10px] text-amber-600 dark:text-amber-400">
                Selection spans {routeAnalyses.length} routes.
                All flights will be moved to <strong>{targetReg}</strong>.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-4 py-3 border-t">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePaste}
            disabled={pasting}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {pasting ? 'Working...' : actionLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Sub-views ─────────────────────────────────────────────────

function FullRouteView({
  classification,
  analysis,
  flightCount,
}: {
  classification: string
  analysis: RouteAnalysis | null
  flightCount: number
}) {
  return (
    <div className="text-[11px] text-muted-foreground">
      {classification === 'FULL_ROUTE' && analysis ? (
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            Route {analysis.routeData.routeName || analysis.routeId.slice(0, 8)}
          </span>
          <span>moves intact ({analysis.allLegSequences.length} legs)</span>
        </div>
      ) : (
        <span>{flightCount} standalone flight{flightCount > 1 ? 's' : ''}</span>
      )}
    </div>
  )
}

function RouteChainPreview({ analysis, movedSeqs }: { analysis: RouteAnalysis; movedSeqs: Set<number> }) {
  const legs = analysis.routeData.legs
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {legs.map((leg, i) => {
        const isMoved = movedSeqs.has(leg.legSequence)
        return (
          <div key={leg.id} className="flex items-center gap-0.5">
            {i > 0 && <span className="text-[8px] text-muted-foreground/40">→</span>}
            <div
              className="px-1.5 py-0.5 rounded text-[9px] font-medium"
              style={{
                background: isMoved
                  ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                  : 'var(--muted)',
                color: isMoved ? 'var(--primary)' : undefined,
                border: isMoved ? '1px solid color-mix(in srgb, var(--primary) 30%, transparent)' : '1px solid transparent',
              }}
            >
              {leg.depStation}→{leg.arrStation}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SplitView({
  analysis,
}: {
  analysis: RouteAnalysis
}) {
  const selectedSet = new Set(analysis.selectedLegSequences)
  const routeName = analysis.routeData.routeName || analysis.routeId.slice(0, 8)
  const splitType = analysis.classification === 'TAIL_SPLIT' ? 'trailing' : 'leading'

  return (
    <div className="space-y-3">
      <div className="text-[11px]">
        <span className="font-medium">Route: {routeName}</span>
        <span className="text-muted-foreground"> — {splitType} {analysis.selectedLegSequences.length} of {analysis.allLegSequences.length} legs selected</span>
      </div>

      {/* Chain preview */}
      <div className="space-y-1">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
        <RouteChainPreview analysis={analysis} movedSeqs={selectedSet} />
      </div>

      {/* New route name */}
      <div className="text-[10px] text-muted-foreground">
        New route: <span className="font-medium text-foreground">{routeName}-S</span>
      </div>
    </div>
  )
}

function MiddleExtractView({
  analysis,
  recommended,
  splitChoice,
  onChoiceChange,
}: {
  analysis: RouteAnalysis
  recommended: ReturnType<typeof getRecommendedOption>
  splitChoice: string
  onChoiceChange: (v: 'selected' | 'recommended' | 'full') => void
}) {
  const previewSeqs = useMemo(() => {
    if (splitChoice === 'selected') return new Set(analysis.selectedLegSequences)
    if (splitChoice === 'recommended' && recommended) return new Set(recommended.movedSequences)
    return new Set(analysis.allLegSequences)
  }, [splitChoice, analysis, recommended])

  return (
    <div className="space-y-3">
      <div className="text-[11px]">
        <span className="font-medium">Route: {analysis.routeData.routeName || analysis.routeId.slice(0, 8)}</span>
        <span className="text-muted-foreground"> — middle extraction</span>
      </div>

      {/* Radio options */}
      <div className="space-y-1.5">
        <RadioOption
          value="selected"
          checked={splitChoice === 'selected'}
          onChange={() => onChoiceChange('selected')}
          label={`Move selected only (${analysis.selectedLegSequences.length} legs)`}
          description="Creates chain break"
          warning
        />
        {recommended && (
          <RadioOption
            value="recommended"
            checked={splitChoice === 'recommended'}
            onChange={() => onChoiceChange('recommended')}
            label={recommended.label}
            description={`${recommended.description} (recommended)`}
            recommended
          />
        )}
        <RadioOption
          value="full"
          checked={splitChoice === 'full'}
          onChange={() => onChoiceChange('full')}
          label="Move entire route"
          description={`${analysis.allLegSequences.length} legs`}
        />
      </div>

      {/* Preview */}
      <div className="space-y-1">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
        <RouteChainPreview analysis={analysis} movedSeqs={previewSeqs} />
      </div>
    </div>
  )
}

function ScatteredView({
  analysis,
  recommended,
  splitChoice,
  onChoiceChange,
}: {
  analysis: RouteAnalysis
  recommended: ReturnType<typeof getRecommendedOption>
  splitChoice: string
  onChoiceChange: (v: 'selected' | 'recommended' | 'full') => void
}) {
  const chainBreaks = useMemo(() => {
    const sorted = [...analysis.selectedLegSequences].sort((a, b) => a - b)
    let breaks = 0
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) breaks++
    }
    return breaks
  }, [analysis.selectedLegSequences])

  const previewSeqs = useMemo(() => {
    if (splitChoice === 'selected') return new Set(analysis.selectedLegSequences)
    if (splitChoice === 'recommended' && recommended) return new Set(recommended.movedSequences)
    return new Set(analysis.allLegSequences)
  }, [splitChoice, analysis, recommended])

  return (
    <div className="space-y-3">
      <div className="text-[11px]">
        <span className="font-medium">Route: {analysis.routeData.routeName || analysis.routeId.slice(0, 8)}</span>
        <span className="text-muted-foreground"> — non-contiguous selection</span>
      </div>

      {/* Radio options */}
      <div className="space-y-1.5">
        <RadioOption
          value="selected"
          checked={splitChoice === 'selected'}
          onChange={() => onChoiceChange('selected')}
          label={`Move selected only (${analysis.selectedLegSequences.length} legs)`}
          description={`${chainBreaks} chain break${chainBreaks > 1 ? 's' : ''}`}
          warning
        />
        {recommended && (
          <RadioOption
            value="recommended"
            checked={splitChoice === 'recommended'}
            onChange={() => onChoiceChange('recommended')}
            label={recommended.label}
            description={`${recommended.description} (recommended)`}
            recommended
          />
        )}
        <RadioOption
          value="full"
          checked={splitChoice === 'full'}
          onChange={() => onChoiceChange('full')}
          label="Move entire route"
          description={`${analysis.allLegSequences.length} legs`}
        />
      </div>

      {/* Preview */}
      <div className="space-y-1">
        <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
        <RouteChainPreview analysis={analysis} movedSeqs={previewSeqs} />
      </div>
    </div>
  )
}

// ─── Radio Option ──────────────────────────────────────────────

function RadioOption({
  value,
  checked,
  onChange,
  label,
  description,
  recommended,
  warning,
}: {
  value: string
  checked: boolean
  onChange: () => void
  label: string
  description?: string
  recommended?: boolean
  warning?: boolean
}) {
  return (
    <label
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        checked
          ? 'bg-primary/5 border border-primary/20'
          : 'hover:bg-muted/30 border border-transparent'
      }`}
      onClick={onChange}
    >
      <input
        type="radio"
        name="pasteOption"
        value={value}
        checked={checked}
        onChange={onChange}
        className="accent-primary mt-0.5"
      />
      <div className="min-w-0">
        <div className="text-[11px] font-medium flex items-center gap-1.5">
          {label}
          {recommended && (
            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase tracking-wider">
              Recommended
            </span>
          )}
        </div>
        {description && (
          <div className={`text-[10px] mt-0.5 ${warning ? 'text-amber-500' : 'text-muted-foreground'}`}>
            {warning && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5" />}
            {description}
          </div>
        )}
      </div>
    </label>
  )
}
