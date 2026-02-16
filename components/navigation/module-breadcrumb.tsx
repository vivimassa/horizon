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
      className="h-7 flex items-end mb-2"
      style={{ paddingLeft: leftOffset }}
    >
      {/* L-shaped connector: vertical line + corner + horizontal line */}
      <div
        className="shrink-0"
        style={{
          width: 10,
          height: 12,
          borderLeft: '1.5px solid #991b1b',
          borderBottom: '1.5px solid #991b1b',
          borderBottomLeftRadius: 3,
        }}
      />
      <span className="text-[13px] font-medium ml-1.5 whitespace-nowrap leading-none">
        <span className="text-red-800">{currentModule.code}.</span>
        <span className="text-gray-700 dark:text-gray-300">
          {' '}
          {currentModule.name}
        </span>
      </span>
    </div>
  )
}
