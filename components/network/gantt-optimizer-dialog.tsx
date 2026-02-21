'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, SlidersHorizontal, Loader2, ChevronRight, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import type { SAProgress, SAResult } from '@/lib/utils/tail-assignment-sa'

// MIP types (Cloud Run solver — no longer from tail-assignment-mip.ts)
interface MIPProgress { phase: 'building' | 'solving' | 'extracting'; message: string; elapsedMs: number }
interface MIPResult {
  assignments: Map<string, string>
  overflow: any[]
  chainBreaks: any[]
  ruleViolations: Map<string, any[]>
  rejections: Map<string, any[]>
  summary: any
  mip: {
    status: 'Optimal' | 'Feasible' | 'Infeasible' | 'TimeLimitReached' | 'Error'
    objectiveValue: number; totalVariables: number; totalConstraints: number
    elapsedMs: number; timeLimitSec: number; gap?: number; message?: string
  }
}
export type { MIPProgress, MIPResult }

// ─── Types ────────────────────────────────────────────────────────────

export type OptimizerMethod = 'greedy' | 'good' | 'ai' | 'optimal'

export interface GanttOptimizerDialogProps {
  open: boolean
  onClose: () => void
  onRunComplete: (method: OptimizerMethod, aiPreset?: 'quick' | 'normal' | 'deep') => void
  currentMethod: OptimizerMethod
  lastRun: { method: string; time: Date } | null
  running: boolean
  ruleCount?: number
  allowFamilySub?: boolean
  onAllowFamilySubChange?: (val: boolean) => void
  aiProgress?: SAProgress | null
  aiResult?: SAResult | null
  onCancelAi?: () => void
  onAskAdvisor?: () => void
  mipProgress?: MIPProgress | null
  mipResult?: MIPResult | null
  onCancelMip?: () => void
  accentColor?: string
  container?: HTMLElement | null
  useMinimumTat?: boolean
  onUseMinimumTatChange?: (val: boolean) => void
  chainContinuity?: 'strict' | 'flexible'
  onChainContinuityChange?: (val: 'strict' | 'flexible') => void
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`
  const hours = Math.floor(minutes / 60)
  return `${hours} hr${hours > 1 ? 's' : ''} ago`
}

// ─── Method Card ──────────────────────────────────────────────────────

function MethodCard({
  value,
  title,
  subtitle,
  selected,
  disabled,
  badge,
  onSelect,
}: {
  value: string
  title: string
  subtitle: string
  selected: boolean
  disabled?: boolean
  badge?: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className="w-full text-left transition-all duration-150"
      style={{
        padding: '12px 14px',
        border: selected ? '1.5px solid hsl(var(--primary))' : '1.5px solid var(--border)',
        borderRadius: 10,
        background: selected ? 'hsl(var(--primary) / 0.04)' : disabled ? 'transparent' : 'transparent',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!disabled && !selected) e.currentTarget.style.background = 'rgba(0,0,0,0.02)'
      }}
      onMouseLeave={(e) => {
        if (!disabled && !selected) e.currentTarget.style.background = 'transparent'
        if (selected) e.currentTarget.style.background = 'hsl(var(--primary) / 0.04)'
      }}
    >
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 12,
            fontSize: 8,
            fontWeight: 700,
            textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.06)',
            padding: '2px 6px',
            borderRadius: 4,
            color: 'var(--muted-foreground)',
          }}
        >
          {badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        {/* Radio dot */}
        <div
          className="shrink-0 mt-0.5"
          style={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            border: selected ? 'none' : '1.5px solid var(--border)',
            background: selected ? 'hsl(var(--primary))' : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 13, fontWeight: 500 }}>{title}</span>
          <span style={{ fontSize: 11, fontStyle: 'italic' }} className="text-muted-foreground">{subtitle}</span>
        </div>
      </div>
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────

export function GanttOptimizerDialog({
  open,
  onClose,
  onRunComplete,
  currentMethod,
  lastRun,
  running,
  ruleCount,
  allowFamilySub,
  onAllowFamilySubChange,
  aiProgress,
  aiResult,
  onCancelAi,
  onAskAdvisor,
  mipProgress,
  mipResult,
  onCancelMip,
  accentColor = '#3B82F6',
  container,
  useMinimumTat,
  onUseMinimumTatChange,
  chainContinuity,
  onChainContinuityChange,
}: GanttOptimizerDialogProps) {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<OptimizerMethod>(currentMethod)
  const [aiPreset, setAiPreset] = useState<'quick' | 'normal' | 'deep'>('normal')

  // Live elapsed timer for MIP overlay
  const mipStartRef = useRef<number>(0)
  const [mipElapsed, setMipElapsed] = useState(0)
  useEffect(() => {
    if (mipProgress) {
      if (!mipStartRef.current) mipStartRef.current = Date.now()
      const id = setInterval(() => {
        setMipElapsed(Math.floor((Date.now() - mipStartRef.current) / 1000))
      }, 1000)
      return () => clearInterval(id)
    }
    mipStartRef.current = 0
    setMipElapsed(0)
  }, [mipProgress])

  // Sync with parent when dialog opens
  useEffect(() => {
    if (open) setSelectedMethod(currentMethod)
  }, [open, currentMethod])

  // Update lastRun display periodically
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!open || !lastRun) return
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [open, lastRun])

  const handleRun = useCallback(() => {
    onRunComplete(
      selectedMethod,
      selectedMethod === 'ai' ? aiPreset : undefined,
    )
  }, [selectedMethod, aiPreset, onRunComplete])

  const CIRCUMFERENCE = 2 * Math.PI * 42

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !aiProgress && !mipProgress) onClose() }}>
      <DialogContent
        className="glass border shadow-lg p-0 gap-0"
        hideClose
        container={container}
        style={{
          width: 640,
          maxWidth: '95vw',
          borderRadius: 16,
          overflow: 'hidden',
        }}

      >
        {/* ── AI Progress Overlay ─────────────────────────── */}
        {aiProgress && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8"
            style={{ background: 'hsl(var(--background) / 0.95)', borderRadius: 16 }}
          >
            {/* Animated ring */}
            <div className="relative mb-6">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="4"
                  strokeDasharray={`${CIRCUMFERENCE}`}
                  strokeDashoffset={`${CIRCUMFERENCE * (1 - Math.min(aiProgress.elapsedMs / aiProgress.timeBudgetMs, 1))}`}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono font-bold" style={{ fontSize: 18 }}>
                  {aiProgress.improvement.toFixed(1)}%
                </span>
                <span className="text-muted-foreground" style={{ fontSize: 9 }}>
                  improved
                </span>
              </div>
            </div>

            {/* Cost comparison */}
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-muted-foreground" style={{ fontSize: 9 }}>Greed Index</div>
                <div className="font-mono font-medium" style={{ fontSize: 14 }}>
                  {aiProgress.initialCost.toLocaleString()}
                </div>
              </div>
              <span className="text-muted-foreground">&rarr;</span>
              <div className="text-center">
                <div style={{ fontSize: 9, color: 'hsl(var(--primary))' }}>Best found</div>
                <div className="font-mono font-bold" style={{ fontSize: 14, color: 'hsl(var(--primary))' }}>
                  {aiProgress.bestCost.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-4 text-muted-foreground" style={{ fontSize: 10 }}>
              <span>{aiProgress.iteration.toLocaleString()} iterations</span>
              <span>{aiProgress.acceptedSwaps.toLocaleString()} swaps</span>
              <span>{Math.max(0, Math.ceil((aiProgress.timeBudgetMs - aiProgress.elapsedMs) / 1000))}s left</span>
            </div>

            {/* Cancel button */}
            <button
              type="button"
              onClick={onCancelAi}
              className="mt-4 text-muted-foreground hover:text-foreground transition-colors"
              style={{ fontSize: 11, padding: '6px 14px', borderRadius: 6 }}
            >
              Cancel and Use Best Solution
            </button>
          </div>
        )}

        {/* ── MIP Progress Overlay ────────────────────────── */}
        {mipProgress && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center px-8"
            style={{ background: 'hsl(var(--background) / 0.95)', borderRadius: 16 }}
          >
            {/* Pulsing logo — keep exactly as-is */}
            <div className="relative mb-6" style={{ width: 200 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: -20,
                  borderRadius: '50%',
                  background: `radial-gradient(circle, ${accentColor}20 0%, transparent 70%)`,
                  animation: 'mip-logo-glow 3s ease-in-out infinite',
                }}
              />
              <img
                src="/horizon-watermark.png"
                alt=""
                style={{
                  width: '100%',
                  height: 'auto',
                  WebkitMaskImage: 'url(/horizon-watermark.png)',
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskImage: 'url(/horizon-watermark.png)',
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  background: accentColor,
                  animation: 'mip-logo-pulse 3s ease-in-out infinite',
                }}
              />
              <style>{`
                @keyframes mip-logo-pulse {
                  0%, 100% { opacity: 0.45; transform: scale(1); }
                  50% { opacity: 1; transform: scale(1.04); }
                }
                @keyframes mip-logo-glow {
                  0%, 100% { opacity: 0.3; transform: scale(0.9); }
                  50% { opacity: 0.7; transform: scale(1.1); }
                }
                @keyframes solver-msg-flash {
                  0% { opacity: 0; transform: translateX(30px); filter: blur(4px); }
                  8% { opacity: 1; transform: translateX(0); filter: blur(0); }
                  88% { opacity: 1; transform: translateX(0); filter: blur(0); }
                  100% { opacity: 0; transform: translateX(-30px); filter: blur(4px); }
                }
              `}</style>
            </div>

            {/* Phase text */}
            <div className="font-medium" style={{ fontSize: 14 }}>
              {mipProgress.phase === 'building' ? 'Preparing optimization...'
                : mipProgress.phase === 'solving' ? 'Finding optimal assignment...'
                : 'Processing result...'}
            </div>

            {/* Sub-text with rotating messages */}
            <div
              key={mipProgress.phase === 'solving' ? Math.floor(mipElapsed / 4) : mipProgress.phase}
              className="text-muted-foreground mt-2"
              style={{
                fontSize: 11,
                animation: mipProgress.phase === 'solving' ? 'solver-msg-flash 4s ease-out both' : undefined,
              }}
            >
              {mipProgress.phase === 'solving'
                ? (() => {
                    const messages = [
                      'Decomposing by aircraft type...',
                      'Evaluating chain continuity...',
                      'Minimizing repositioning...',
                      'Checking overlap constraints...',
                      'Optimizing fleet utilization...',
                      'Reducing overflow flights...',
                      'Balancing daily assignments...',
                    ]
                    return messages[Math.floor(mipElapsed / 4) % messages.length]
                  })()
                : mipProgress.phase === 'building' ? 'Analyzing schedule structure...'
                : 'Almost there...'}
            </div>

            {/* Progress bar */}
            <div style={{ width: '60%', marginTop: 20 }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: 'hsl(var(--border))',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    borderRadius: 2,
                    background: accentColor,
                    transition: 'width 1s ease-out',
                    width: (() => {
                      if (mipProgress.phase === 'building') return '5%'
                      if (mipProgress.phase === 'extracting') return '100%'
                      // Solving: asymptotic approach to 95%
                      const pct = Math.min(95, 95 * (1 - Math.exp(-mipElapsed / 40)))
                      return `${pct}%`
                    })(),
                  }}
                />
              </div>
            </div>

            {/* Elapsed time */}
            <div className="text-muted-foreground mt-3" style={{ fontSize: 10 }}>
              {mipElapsed < 60
                ? `${mipElapsed}s elapsed`
                : `${Math.floor(mipElapsed / 60)}m ${mipElapsed % 60}s elapsed`}
            </div>

            {/* Cancel */}
            {onCancelMip && (
              <button
                type="button"
                onClick={onCancelMip}
                className="mt-4 text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontSize: 11, padding: '6px 14px', borderRadius: 6 }}
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* ── Header ──────────────────────────────────────── */}
        <div style={{ padding: '20px 20px 12px 20px' }}>
          <div className="flex items-start justify-between">
            <div>
              <DialogHeader className="p-0 space-y-0">
                <DialogTitle style={{ fontSize: 15, fontWeight: 700 }}>
                  ✈ Aircraft Tail Assignment
                </DialogTitle>
              </DialogHeader>
              <p style={{ fontSize: 12, marginTop: 4 }} className="text-muted-foreground">
                Assign aircraft tails using your preferred method
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-1 -mr-1 -mt-1"
            >
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div style={{ padding: '0 20px 16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {/* ASSIGNMENT OPTIONS section */}
          <div>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                display: 'block',
              }}
              className="text-muted-foreground"
            >
              Assignment Options
            </span>

            <label
              className="flex items-center justify-between p-3 rounded-[10px] border border-border cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-3">
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  Allow same-family substitution
                </div>
                <p style={{ fontSize: 11 }} className="text-muted-foreground mt-0.5">
                  When exact type unavailable, assign to another type in the same family (e.g. A320 ↔ A321)
                </p>
              </div>
              <Switch
                checked={allowFamilySub ?? false}
                onCheckedChange={(val) => onAllowFamilySubChange?.(val)}
              />
            </label>

            <label
              className="flex items-center justify-between p-3 rounded-[10px] border border-border cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0 mr-3">
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  Use minimum turnaround time
                </div>
                <p style={{ fontSize: 11 }} className="text-muted-foreground mt-0.5">
                  Use operational minimum TAT instead of scheduled TAT. Shorter turnarounds may allow tighter rotations but reduce ground buffer.
                </p>
              </div>
              <Switch
                checked={useMinimumTat ?? false}
                onCheckedChange={(val) => onUseMinimumTatChange?.(val)}
              />
            </label>

            {/* Chain Continuity toggle — only for CG solver */}
            {selectedMethod === 'optimal' && (
              <div className="mt-3">
                <span
                  className="text-muted-foreground block mb-2"
                  style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Chain Continuity
                </span>
                <div className="flex gap-1.5">
                  {([
                    { key: 'flexible' as const, label: 'Flexible', desc: 'Maximize coverage. Ferry positioning allowed to reduce unassigned flights.' },
                    { key: 'strict' as const, label: 'Strict', desc: 'Enforce DEP/ARR continuity. No ferry flights. Higher risk of unassigned flights.' },
                  ]).map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => onChainContinuityChange?.(opt.key)}
                      className="flex-1 py-2 px-3 rounded-lg border text-left transition-colors"
                      style={{
                        borderColor: (chainContinuity ?? 'flexible') === opt.key ? 'hsl(var(--primary))' : 'var(--border)',
                        background: (chainContinuity ?? 'flexible') === opt.key ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if ((chainContinuity ?? 'flexible') !== opt.key) e.currentTarget.style.borderColor = 'var(--muted-foreground)'
                      }}
                      onMouseLeave={(e) => {
                        if ((chainContinuity ?? 'flexible') !== opt.key) e.currentTarget.style.borderColor = 'var(--border)'
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{opt.label}</div>
                      <div style={{ fontSize: 9, lineHeight: 1.4, marginTop: 2 }} className="text-muted-foreground">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: '1px dashed var(--border)',
              margin: '16px 0',
            }}
          />

          {/* METHOD section */}
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                display: 'block',
              }}
              className="text-muted-foreground"
            >
              Assignment Method
            </span>
            <div className="flex flex-col" style={{ gap: 6 }}>
              <MethodCard
                value="greedy"
                title="Greedy Solution"
                subtitle="Minimize aircraft used"
                selected={selectedMethod === 'greedy'}
                onSelect={() => setSelectedMethod('greedy')}
              />
              <MethodCard
                value="good"
                title="Good Solution"
                subtitle="Balance hours across fleet"
                selected={selectedMethod === 'good'}
                onSelect={() => setSelectedMethod('good')}
              />
              <MethodCard
                value="ai"
                title="AI Optimizer"
                subtitle="Iteratively improves greedy via simulated annealing"
                selected={selectedMethod === 'ai'}
                onSelect={() => setSelectedMethod('ai')}
              />
              <MethodCard
                value="optimal"
                title="Column Generation Solver"
                subtitle="Best possible assignment using column generation"
                selected={selectedMethod === 'optimal'}
                onSelect={() => setSelectedMethod('optimal')}
              />
            </div>

            {/* Time budget selector (AI only) */}
            {selectedMethod === 'ai' && (
              <div className="mt-3 ml-1">
                <span
                  className="text-muted-foreground block mb-2"
                  style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                >
                  Time Budget
                </span>
                <div className="flex gap-1.5">
                  {([
                    { key: 'quick' as const, label: '5 sec', desc: 'Quick scan' },
                    { key: 'normal' as const, label: '15 sec', desc: 'Recommended' },
                    { key: 'deep' as const, label: '30 sec', desc: 'Deep search' },
                  ]).map(preset => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setAiPreset(preset.key)}
                      className="flex-1 py-2 rounded-lg border text-center transition-colors"
                      style={{
                        borderColor: aiPreset === preset.key ? 'hsl(var(--primary))' : 'var(--border)',
                        background: aiPreset === preset.key ? 'hsl(var(--primary) / 0.05)' : 'transparent',
                      }}
                      onMouseEnter={(e) => {
                        if (aiPreset !== preset.key) e.currentTarget.style.borderColor = 'var(--muted-foreground)'
                      }}
                      onMouseLeave={(e) => {
                        if (aiPreset !== preset.key) e.currentTarget.style.borderColor = 'var(--border)'
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{preset.label}</div>
                      <div style={{ fontSize: 9 }} className="text-muted-foreground">{preset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: '1px dashed var(--border)',
              margin: '16px 0',
            }}
          />

          {/* PREFERENCES & RESTRICTIONS section */}
          <div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
                display: 'block',
              }}
              className="text-muted-foreground"
            >
              Preferences &amp; Restrictions
            </span>
            <button
              type="button"
              onClick={() => { onClose(); router.push('/admin/network-config/schedule-preferences') }}
              className="w-full text-left transition-all duration-150"
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 10,
                padding: '12px 14px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--foreground)'; e.currentTarget.style.background = 'rgba(0,0,0,0.02)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Preferences & Restrictions</span>
                </div>
                <ChevronRight style={{ width: 14, height: 14 }} className="text-muted-foreground" />
              </div>
              <p style={{ fontSize: 11, marginTop: 4, marginLeft: 22 }} className="text-muted-foreground">
                {(ruleCount ?? 0) > 0
                  ? `${ruleCount} rule${ruleCount !== 1 ? 's' : ''} active — affects all methods`
                  : 'No rules configured — click to set up'}
              </p>
            </button>
          </div>

          {/* Explainer */}
          <p
            style={{ fontSize: 10, marginTop: 14, fontStyle: 'italic' }}
            className="text-muted-foreground"
          >
            All methods respect the same constraints. The difference is how well they solve.
          </p>
        </div>

        {/* ── AI Result Comparison Banner ─────────────────── */}
        {aiResult && !aiProgress && (
          <div className="px-5 pb-4">
            <div className="rounded-lg border p-3" style={{ background: 'hsl(var(--primary) / 0.05)', borderColor: 'hsl(var(--primary) / 0.2)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--primary))' }}>
                    AI Optimization Complete
                  </div>
                  <div className="text-muted-foreground mt-0.5" style={{ fontSize: 10 }}>
                    {aiResult.sa.iterations.toLocaleString()} iterations in {(aiResult.sa.elapsedMs / 1000).toFixed(1)}s
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold" style={{ fontSize: 16, color: 'hsl(var(--primary))' }}>
                    {aiResult.sa.improvement > 0 ? '-' : ''}{aiResult.sa.improvement.toFixed(1)}%
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: 9 }}>
                    cost reduction
                  </div>
                </div>
              </div>
              <div className="flex gap-4 mt-2 text-muted-foreground" style={{ fontSize: 9 }}>
                <span>Greedy: {aiResult.sa.initialCost.toLocaleString()}</span>
                <span>&rarr;</span>
                <span>AI: {aiResult.sa.finalCost.toLocaleString()}</span>
                <span>&middot;</span>
                <span>{aiResult.sa.acceptedSwaps.toLocaleString()} swaps made</span>
              </div>
            </div>
          </div>
        )}

        {/* ── MIP Result Banner ──────────────────────────── */}
        {mipResult && !mipProgress && (
          <div className="px-5 pb-4">
            <div className="rounded-lg border p-3" style={{
              background: mipResult.mip.status === 'Error' ? 'hsl(0 84% 60% / 0.06)'
                : mipResult.mip.status === 'Infeasible' ? 'hsl(30 90% 50% / 0.06)'
                : mipResult.mip.status === 'Optimal' ? 'hsl(142 71% 45% / 0.06)'
                : 'hsl(var(--primary) / 0.05)',
              borderColor: mipResult.mip.status === 'Error' ? 'hsl(0 84% 60% / 0.25)'
                : mipResult.mip.status === 'Infeasible' ? 'hsl(30 90% 50% / 0.25)'
                : mipResult.mip.status === 'Optimal' ? 'hsl(142 71% 45% / 0.25)'
                : 'hsl(var(--primary) / 0.2)',
            }}>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 600,
                    color: mipResult.mip.status === 'Error' ? 'hsl(0 84% 60%)'
                      : mipResult.mip.status === 'Infeasible' ? 'hsl(30 90% 50%)'
                      : mipResult.mip.status === 'Optimal' ? '#22C55E'
                      : 'hsl(var(--primary))',
                  }}>
                    {mipResult.mip.status === 'Optimal' ? '\u2713 Optimal Solution Found'
                      : mipResult.mip.status === 'Feasible' ? '\u25C9 Near-optimal Solution (time limit reached)'
                      : mipResult.mip.status === 'Infeasible' ? '\u2717 No Feasible Solution'
                      : '\u26A0 Solver Error'}
                  </div>
                  <div className="text-muted-foreground mt-0.5" style={{ fontSize: 10 }}>
                    {mipResult.mip.totalVariables.toLocaleString()} variables,{' '}
                    {mipResult.mip.totalConstraints.toLocaleString()} constraints
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold" style={{
                    fontSize: 14,
                    color: mipResult.mip.status === 'Optimal' ? '#22C55E'
                      : mipResult.mip.status === 'Error' ? 'hsl(0 84% 60%)'
                      : mipResult.mip.status === 'Infeasible' ? 'hsl(30 90% 50%)'
                      : 'hsl(var(--primary))',
                  }}>
                    {mipResult.mip.status === 'Optimal' ? 'OPTIMAL' : mipResult.mip.status.toUpperCase()}
                  </div>
                  <div className="text-muted-foreground" style={{ fontSize: 9 }}>
                    {(mipResult.mip.elapsedMs / 1000).toFixed(1)}s
                  </div>
                </div>
              </div>
              {mipResult.mip.message && (
                <p className="text-muted-foreground mt-2" style={{ fontSize: 10, lineHeight: 1.4 }}>
                  {mipResult.mip.message}
                </p>
              )}
              {(mipResult.mip.status === 'Optimal' || mipResult.mip.status === 'Feasible') && (
                <div className="flex gap-4 mt-2 text-muted-foreground" style={{ fontSize: 9 }}>
                  <span>Cost: {mipResult.mip.objectiveValue.toLocaleString()}</span>
                  <span>&middot;</span>
                  <span>{mipResult.overflow.length} overflow</span>
                  <span>&middot;</span>
                  <span>{mipResult.chainBreaks.length} chain breaks</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────── */}
        <div
          className="border-t flex items-center justify-between"
          style={{ padding: '14px 20px' }}
        >
          <span style={{ fontSize: 10, fontStyle: 'italic' }} className="text-muted-foreground">
            {lastRun
              ? `Last run: ${lastRun.method}, ${formatTimeAgo(lastRun.time)}`
              : 'No assignment run yet'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
              style={{ height: 34, padding: '0 14px', fontSize: 12, fontWeight: 500, borderRadius: 8 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="text-white transition-all duration-200 flex items-center gap-1.5"
              style={{
                height: 34,
                padding: '0 18px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 8,
                background: running ? '#6b7280' : 'hsl(var(--primary))',
                cursor: running ? 'wait' : 'pointer',
              }}
            >
              {running ? (
                <>
                  <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
                  Running...
                </>
              ) : (
                <>&#9654; Run Assignment</>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
