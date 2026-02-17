'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

// ─── Types ───────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: string
  type: ToastType
  title: string
  body?: string
  items?: string[]
  dismissMs: number | null // null = persist until closed
  createdAt: number
}

interface ToastContextValue {
  success: (title: string, opts?: ToastOpts) => void
  error: (title: string, opts?: ToastOpts) => void
  warning: (title: string, opts?: ToastOpts) => void
  info: (title: string, opts?: ToastOpts) => void
  dismiss: (id: string) => void
}

interface ToastOpts {
  description?: string
  items?: string[]
  duration?: number // override auto-dismiss ms, null = persist
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

// ─── Singleton API (works outside React tree) ────────────────

let _singletonPush: ((t: ToastItem) => void) | null = null
let _singletonDismiss: ((id: string) => void) | null = null

function makeSingleton(type: ToastType, defaultMs: number | null) {
  return (title: string, opts?: ToastOpts) => {
    const item: ToastItem = {
      id: crypto.randomUUID(),
      type,
      title,
      body: opts?.description,
      items: opts?.items,
      dismissMs: opts?.duration !== undefined ? opts.duration : defaultMs,
      createdAt: Date.now(),
    }
    if (_singletonPush) _singletonPush(item)
  }
}

export const toast = {
  success: makeSingleton('success', 3000),
  error: makeSingleton('error', 5000),
  warning: makeSingleton('warning', 5000),
  info: makeSingleton('info', 4000),
}

// ─── Icons (SF-style inline SVGs) ───────────────────────────

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#22c55e" opacity="0.15" />
      <circle cx="10" cy="10" r="9" stroke="#22c55e" strokeWidth="1.5" fill="none" />
      <path d="M6.5 10.5L8.5 12.5L13.5 7.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#ef4444" opacity="0.15" />
      <circle cx="10" cy="10" r="9" stroke="#ef4444" strokeWidth="1.5" fill="none" />
      <path d="M7.5 7.5L12.5 12.5M12.5 7.5L7.5 12.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M10 2L18.66 17H1.34L10 2Z" fill="#f59e0b" opacity="0.15" stroke="#f59e0b" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 8V11.5" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="14" r="0.75" fill="#f59e0b" />
    </svg>
  )
}

function InfoCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="9" fill="#3b82f6" opacity="0.15" />
      <circle cx="10" cy="10" r="9" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
      <path d="M10 9V14" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="6.5" r="0.75" fill="#3b82f6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

const ICON_MAP: Record<ToastType, () => JSX.Element> = {
  success: CheckCircleIcon,
  error: XCircleIcon,
  warning: WarningIcon,
  info: InfoCircleIcon,
}

const ACCENT_MAP: Record<ToastType, string> = {
  success: 'rgba(34, 197, 94, 0.8)',
  error: 'rgba(239, 68, 68, 0.8)',
  warning: 'rgba(245, 158, 11, 0.8)',
  info: 'rgba(59, 130, 246, 0.8)',
}

// ─── Single Toast ───────────────────────────────────────────

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveredRef = useRef(false)

  const startDismiss = useCallback(() => {
    setExiting(true)
    setTimeout(onDismiss, 150)
  }, [onDismiss])

  // Auto-dismiss timer
  useEffect(() => {
    if (item.dismissMs === null) return
    const start = () => {
      timerRef.current = setTimeout(startDismiss, item.dismissMs!)
    }
    if (!hoveredRef.current) start()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [item.dismissMs, startDismiss])

  const handleMouseEnter = () => {
    hoveredRef.current = true
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  const handleMouseLeave = () => {
    hoveredRef.current = false
    if (item.dismissMs !== null) {
      timerRef.current = setTimeout(startDismiss, item.dismissMs)
    }
  }

  const Icon = ICON_MAP[item.type]

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={exiting ? 'vt-exit' : 'vt-enter'}
      style={{
        maxWidth: 420,
        padding: '14px 18px',
        borderRadius: 16,
        borderLeft: `3px solid ${ACCENT_MAP[item.type]}`,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        position: 'relative',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ flexShrink: 0, marginTop: 1 }}><Icon /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, lineHeight: '18px' }} className="text-[#1a1a1a] dark:text-[#f5f5f5]">
          {item.title}
        </div>
        {item.body && (
          <div style={{ fontSize: 12, fontWeight: 400, lineHeight: '16px', marginTop: 4 }} className="text-[#6b7280]">
            {item.body}
          </div>
        )}
        {item.items && item.items.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {item.items.map((line, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: '16px' }} className="text-[#6b7280]">
                <span style={{ marginRight: 6, opacity: 0.5 }}>&bull;</span>{line}
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={startDismiss}
        className="text-[#9ca3af] hover:text-[#6b7280] dark:text-[#6b7280] dark:hover:text-[#9ca3af]"
        style={{ flexShrink: 0, padding: 2, marginTop: -2, marginRight: -4, cursor: 'pointer', background: 'none', border: 'none', transition: 'color 150ms' }}
      >
        <CloseIcon />
      </button>
    </div>
  )
}

// ─── Provider & Container ───────────────────────────────────

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const push = useCallback((item: ToastItem) => {
    setItems(prev => [item, ...prev])
  }, [])

  const dismiss = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  // Register singleton
  useEffect(() => {
    _singletonPush = push
    _singletonDismiss = dismiss
    return () => { _singletonPush = null; _singletonDismiss = null }
  }, [push, dismiss])

  const ctx: ToastContextValue = {
    success: (title, opts) => toast.success(title, opts),
    error: (title, opts) => toast.error(title, opts),
    warning: (title, opts) => toast.warning(title, opts),
    info: (title, opts) => toast.info(title, opts),
    dismiss,
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {mounted && createPortal(
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            pointerEvents: 'none',
          }}
        >
          <style>{`
            .vt-enter {
              animation: vt-slide-in 200ms ease-out forwards;
              background: rgba(255,255,255,0.85);
              backdrop-filter: blur(40px) saturate(180%);
              -webkit-backdrop-filter: blur(40px) saturate(180%);
              border: 1px solid rgba(255,255,255,0.5);
              box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6);
            }
            .dark .vt-enter, .dark .vt-exit {
              background: rgba(30,30,30,0.85) !important;
              border-color: rgba(255,255,255,0.1) !important;
              box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05) !important;
            }
            .vt-exit {
              animation: vt-slide-out 150ms ease-in forwards;
              background: rgba(255,255,255,0.85);
              backdrop-filter: blur(40px) saturate(180%);
              -webkit-backdrop-filter: blur(40px) saturate(180%);
              border: 1px solid rgba(255,255,255,0.5);
              box-shadow: 0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6);
            }
            @keyframes vt-slide-in {
              from { opacity: 0; transform: translateX(40px); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes vt-slide-out {
              from { opacity: 1; transform: translateX(0); }
              to { opacity: 0; transform: translateX(40px); }
            }
          `}</style>
          {items.map(item => (
            <ToastCard key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}
