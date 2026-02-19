'use client'

import { usePathname } from 'next/navigation'
import { MODULE_REGISTRY, type ModuleEntry } from '@/lib/modules/registry'

interface ModuleBreadcrumbProps {
  /** Left offset in pixels to align connector with the active parent tab */
  leftOffset?: number
  /** Pre-resolved module entry (skips internal pathname lookup when provided) */
  module?: ModuleEntry | null
}

/**
 * Finds the deepest (most-specific) module matching the given pathname.
 * Only considers level >= 2 entries (leaf pages below the tab level).
 */
function resolveModule(pathname: string): ModuleEntry | null {
  return (
    MODULE_REGISTRY
      .filter(
        (m) =>
          m.level >= 2 &&
          (m.route === pathname || pathname.startsWith(m.route + '/'))
      )
      .sort((a, b) => b.route.length - a.route.length)[0] ?? null
  )
}

export { resolveModule }

export function ModuleBreadcrumb({ leftOffset = 8, module: moduleProp }: ModuleBreadcrumbProps) {
  const pathname = usePathname()

  const currentModule =
    moduleProp !== undefined ? moduleProp : resolveModule(pathname)

  if (!currentModule) return null

  return (
    <div
      className="relative mb-2"
      style={{ height: 28, marginTop: 4 }}
    >
      {/* Vertical line from tab center */}
      <div
        style={{
          position: 'absolute',
          left: leftOffset,
          top: 0,
          width: 2,
          height: 16,
          backgroundColor: 'hsl(var(--primary))',
        }}
      />
      {/* Corner + horizontal line */}
      <div
        style={{
          position: 'absolute',
          left: leftOffset,
          top: 14,
          width: 14,
          height: 2,
          backgroundColor: 'hsl(var(--primary))',
          borderRadius: '0 0 0 2px',
        }}
      />
      {/* Page name */}
      <span
        className="absolute whitespace-nowrap"
        style={{
          left: leftOffset + 18,
          top: 8,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <span className="text-primary font-semibold">{currentModule.code}.</span>
        <span className="text-foreground ml-1">
          {currentModule.name}
        </span>
      </span>
    </div>
  )
}
