'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { MODULE_REGISTRY, type ModuleEntry } from '@/lib/modules/registry'

interface ModuleTabsProps {
  moduleBase: string   // e.g. "/network"
  moduleName: string   // e.g. "Network" (kept for backward compat)
}

// ─── Click Outside Hook ───────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

// ─── Section Pill (primary color, left) ───────────────────

function SectionPill({
  sections,
  activeSection,
  onSelect,
}: {
  sections: ModuleEntry[]
  activeSection: ModuleEntry
  onSelect: (section: ModuleEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 12px 7px 10px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, hsl(var(--primary) / 0.7), hsl(var(--primary) / 0.9))',
          border: '1px solid hsl(var(--primary) / 0.4)',
          color: 'hsl(var(--primary-foreground))',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 2px 12px hsl(var(--primary) / 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
          transition: 'all 0.2s',
        }}
      >
        <span style={{ fontSize: 11, opacity: 0.7, fontFamily: "'SF Mono', ui-monospace, monospace" }}>
          {activeSection.code}
        </span>
        <span>{activeSection.name}</span>
        <span
          style={{
            fontSize: 10,
            opacity: 0.6,
            marginLeft: 2,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'inline-block',
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 100,
            background: 'var(--nav-dropdown-bg)',
            backdropFilter: 'blur(40px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
            border: '1px solid var(--nav-glass-border)',
            borderRadius: 18,
            padding: 8,
            boxShadow: 'var(--nav-dropdown-shadow), 0 0 0 1px var(--nav-glass-border)',
            minWidth: 280,
            animation: 'dropIn 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {sections.map(section => {
            const isActive = section.code === activeSection.code
            return (
              <button
                key={section.code}
                onClick={() => { onSelect(section); setOpen(false) }}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: isActive ? 'hsl(var(--primary) / 0.1)' : 'transparent',
                  border: isActive ? '1px solid hsl(var(--primary) / 0.15)' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  marginBottom: 2,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--nav-glass-hover)'
                    e.currentTarget.style.borderColor = 'var(--nav-glass-border)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'hsl(var(--primary))',
                        fontFamily: "'SF Mono', ui-monospace, monospace",
                      }}
                    >
                      {section.code}
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isActive ? 'var(--nav-text-active)' : 'var(--nav-text)',
                      }}
                    >
                      {section.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--nav-text-muted)',
                      marginTop: 2,
                      lineHeight: 1.35,
                    }}
                  >
                    {section.description}
                  </div>
                </div>
                {isActive && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'hsl(var(--primary))',
                      boxShadow: '0 0 6px hsl(var(--primary) / 0.4)',
                      alignSelf: 'center',
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Sub-Page Pill (glass, right) ─────────────────────────

function SubPagePill({
  subPages,
  activeSubPage,
  onSelect,
}: {
  subPages: ModuleEntry[]
  activeSubPage: ModuleEntry
  onSelect: (subPage: ModuleEntry) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px 6px 8px',
          borderRadius: 10,
          background: 'var(--nav-glass-bg)',
          border: '1px solid var(--nav-glass-border)',
          color: 'var(--nav-text)',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.2s',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--nav-glass-hover)'
          e.currentTarget.style.borderColor = 'var(--nav-glass-hover-border)'
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.background = 'var(--nav-glass-bg)'
            e.currentTarget.style.borderColor = 'var(--nav-glass-border)'
          }
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: 'hsl(var(--primary))',
            fontWeight: 700,
            fontFamily: "'SF Mono', ui-monospace, monospace",
          }}
        >
          {activeSubPage.code}
        </span>
        <span>{activeSubPage.name}</span>
        <span
          style={{
            fontSize: 9,
            color: 'var(--nav-text-muted)',
            marginLeft: 2,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            display: 'inline-block',
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            background: 'var(--nav-dropdown-bg)',
            backdropFilter: 'blur(40px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
            border: '1px solid var(--nav-glass-border)',
            borderRadius: 16,
            padding: 6,
            boxShadow: 'var(--nav-dropdown-shadow), 0 0 0 1px var(--nav-glass-border)',
            minWidth: 320,
            animation: 'dropIn 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          {subPages.map(child => {
            const isActive = child.code === activeSubPage.code
            return (
              <button
                key={child.code}
                onClick={() => { onSelect(child); setOpen(false) }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: isActive ? 'hsl(var(--primary) / 0.08)' : 'transparent',
                  border: isActive ? '1px solid hsl(var(--primary) / 0.12)' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textAlign: 'left',
                  marginBottom: 1,
                }}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--nav-glass-hover)'
                    e.currentTarget.style.borderColor = 'var(--nav-glass-border)'
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.borderColor = 'transparent'
                  }
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'hsl(var(--primary))',
                        fontFamily: "'SF Mono', ui-monospace, monospace",
                      }}
                    >
                      {child.code}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: isActive ? 'var(--nav-text-active)' : 'var(--nav-text)',
                      }}
                    >
                      {child.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--nav-text-muted)',
                      marginTop: 1,
                      lineHeight: 1.3,
                    }}
                  >
                    {child.description}
                  </div>
                </div>
                {isActive && (
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: 'hsl(var(--primary))',
                      boxShadow: '0 0 6px hsl(var(--primary) / 0.4)',
                      alignSelf: 'center',
                      flexShrink: 0,
                    }}
                  />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────

export function ModuleTabs({ moduleBase }: ModuleTabsProps) {
  const pathname = usePathname()
  const router = useRouter()

  // Get level-1 sections for this module base (e.g. 1.1, 1.2, 1.3)
  const sections = MODULE_REGISTRY.filter(
    m => m.level === 1 && m.route.startsWith(moduleBase + '/')
  )

  // Determine active section by matching pathname
  const activeSection = sections.find(s =>
    pathname === s.route || pathname.startsWith(s.route + '/')
  ) || sections[0]

  // Get level-2 children of active section
  const subPages = activeSection
    ? MODULE_REGISTRY.filter(m => m.parent_code === activeSection.code && m.level === 2)
    : []

  // Determine active sub-page
  const activeSubPage = subPages.find(p =>
    pathname === p.route || pathname.startsWith(p.route + '/')
  ) || null

  const handleSectionSelect = useCallback((section: ModuleEntry) => {
    router.push(section.route)
  }, [router])

  const handleSubPageSelect = useCallback((subPage: ModuleEntry) => {
    router.push(subPage.route)
  }, [router])

  if (!activeSection) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <SectionPill
        sections={sections}
        activeSection={activeSection}
        onSelect={handleSectionSelect}
      />

      {activeSubPage && (
        <>
          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'var(--nav-divider)' }} />

          <SubPagePill
            subPages={subPages}
            activeSubPage={activeSubPage}
            onSelect={handleSubPageSelect}
          />
        </>
      )}
    </div>
  )
}
