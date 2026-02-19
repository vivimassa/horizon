'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Settings2, Loader2, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// ─── Types ────────────────────────────────────────────────────────────

export type OptimizerMethod = 'greedy' | 'good'

export interface GanttOptimizerDialogProps {
  open: boolean
  onClose: () => void
  onRunComplete: (method: OptimizerMethod) => void
  currentMethod: OptimizerMethod
  lastRun: { method: string; time: Date } | null
  running: boolean
  container?: HTMLElement | null
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
  container,
}: GanttOptimizerDialogProps) {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<OptimizerMethod>(currentMethod)

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
    onRunComplete(selectedMethod)
  }, [selectedMethod, onRunComplete])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="glass border shadow-lg p-0 gap-0"
        hideClose
        style={{
          width: 480,
          maxWidth: '95vw',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        {...(container ? { container } : {})}
      >
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
                subtitle="Best possible solution"
                selected={false}
                disabled
                badge="Coming Soon"
                onSelect={() => {}}
              />
            </div>
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
                  <Settings2 style={{ width: 14, height: 14 }} className="text-muted-foreground" />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Configuration</span>
                </div>
                <ChevronRight style={{ width: 14, height: 14 }} className="text-muted-foreground" />
              </div>
              <p style={{ fontSize: 11, marginTop: 4, marginLeft: 22 }} className="text-muted-foreground">
                No rules configured — click to set up
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
                <>▶ Run Assignment</>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
