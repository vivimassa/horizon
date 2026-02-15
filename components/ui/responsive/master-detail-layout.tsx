'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { ArrowLeft, ChevronRight, ChevronLeft } from 'lucide-react'

interface MasterDetailLayoutProps<T> {
  items: T[]
  selectedItem: T | null
  onSelectItem: (item: T | null) => void
  keyExtractor: (item: T) => string
  renderListItem: (item: T, isSelected: boolean) => React.ReactNode
  renderCompactListItem?: (item: T, isSelected: boolean) => React.ReactNode
  renderDetail: (item: T) => React.ReactNode
  renderEmptyDetail?: () => React.ReactNode
  renderListHeader?: () => React.ReactNode
  renderListBody?: (renderItem: (item: T) => React.ReactNode) => React.ReactNode
  listWidth?: 'narrow' | 'default' | 'wide'
  className?: string
  onViewChange?: (view: 'list' | 'detail') => void
}

type ActiveView = 'list' | 'detail'

// Internal props for sub-layouts where onSelectItem only receives T (not null)
interface SubLayoutProps<T> {
  items: T[]
  selectedItem: T | null
  onSelectItem: (item: T) => void
  keyExtractor: (item: T) => string
  renderListItem: (item: T, isSelected: boolean) => React.ReactNode
  renderDetail: (item: T) => React.ReactNode
  renderEmptyDetail?: () => React.ReactNode
  renderListHeader?: () => React.ReactNode
  renderListBody?: (renderItem: (item: T) => React.ReactNode) => React.ReactNode
  className?: string
}

const listWidthClasses = {
  narrow: 'w-1/4',
  default: 'w-1/3',
  wide: 'w-2/5',
} as const

export function MasterDetailLayout<T>({
  items,
  selectedItem,
  onSelectItem,
  keyExtractor,
  renderListItem,
  renderCompactListItem,
  renderDetail,
  renderEmptyDetail,
  renderListHeader,
  renderListBody,
  listWidth = 'default',
  className,
  onViewChange,
}: MasterDetailLayoutProps<T>) {
  const breakpoint = useBreakpoint()
  const [activeView, setActiveView] = useState<ActiveView>('list')
  const [tabletExpanded, setTabletExpanded] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null!)

  // Track if we pushed to history for mobile back-button support
  const historyPushedRef = useRef(false)

  const handleSelectItem = useCallback((item: T) => {
    onSelectItem(item)
    if (breakpoint === 'mobile') {
      setActiveView('detail')
      onViewChange?.('detail')
      window.history.pushState({ masterDetailView: 'detail' }, '')
      historyPushedRef.current = true
    }
    if (breakpoint === 'tablet') {
      setTabletExpanded(false)
    }
  }, [breakpoint, onSelectItem, onViewChange])

  const handleBackToList = useCallback(() => {
    setActiveView('list')
    onViewChange?.('list')
    onSelectItem(null)
    if (historyPushedRef.current) {
      historyPushedRef.current = false
    }
  }, [onSelectItem, onViewChange])

  // Browser back-button support on mobile
  useEffect(() => {
    if (breakpoint !== 'mobile') return

    const handlePopState = () => {
      if (activeView === 'detail') {
        setActiveView('list')
        onViewChange?.('list')
        onSelectItem(null)
        historyPushedRef.current = false
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [breakpoint, activeView, onSelectItem, onViewChange])

  // Reset view when breakpoint changes
  useEffect(() => {
    if (breakpoint === 'desktop') {
      setActiveView('list')
      setTabletExpanded(false)
    }
  }, [breakpoint])

  // Close tablet overlay on outside click
  useEffect(() => {
    if (!tabletExpanded) return
    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        setTabletExpanded(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTabletExpanded(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [tabletExpanded])

  if (breakpoint === 'desktop') {
    return <DesktopLayout {...{ items, selectedItem, onSelectItem: handleSelectItem, keyExtractor, renderListItem, renderDetail, renderEmptyDetail, renderListHeader, renderListBody, listWidth, className }} />
  }

  if (breakpoint === 'tablet') {
    return (
      <TabletLayout
        {...{ items, selectedItem, onSelectItem: handleSelectItem, keyExtractor, renderListItem, renderCompactListItem, renderDetail, renderEmptyDetail, renderListHeader, renderListBody, className }}
        expanded={tabletExpanded}
        onToggleExpand={() => setTabletExpanded(!tabletExpanded)}
        overlayRef={overlayRef}
      />
    )
  }

  return (
    <MobileLayout
      {...{ items, selectedItem, onSelectItem: handleSelectItem, keyExtractor, renderListItem, renderDetail, renderEmptyDetail, renderListHeader, renderListBody, className }}
      activeView={activeView}
      onBack={handleBackToList}
    />
  )
}

// ─── Desktop: side-by-side ───────────────────────────────────────────────

function DesktopLayout<T>({
  items, selectedItem, onSelectItem, keyExtractor, renderListItem, renderDetail, renderEmptyDetail, renderListHeader, renderListBody, listWidth = 'default', className,
}: SubLayoutProps<T> & { listWidth?: 'narrow' | 'default' | 'wide' }) {
  const renderItemButton = (item: T) => {
    const key = keyExtractor(item)
    const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false
    return (
      <button
        key={key}
        onClick={() => onSelectItem(item)}
        className={cn(
          'w-full text-left rounded-xl px-3 py-2.5 transition-all duration-200',
          isSelected
            ? 'bg-primary/15 text-primary'
            : 'text-foreground hover:bg-white/50 dark:hover:bg-white/10'
        )}
      >
        {renderListItem(item, isSelected)}
      </button>
    )
  }

  return (
    <div className={cn('flex gap-4', className)}>
      {/* List panel */}
      <div className={cn('glass rounded-2xl p-4 overflow-hidden flex flex-col', listWidthClasses[listWidth])}>
        {renderListHeader?.()}
        <div className="flex-1 overflow-y-auto mt-3 space-y-1 custom-scrollbar">
          {renderListBody
            ? renderListBody(renderItemButton)
            : items.map(renderItemButton)
          }
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 glass rounded-2xl p-6 overflow-hidden min-h-0">
        {selectedItem ? renderDetail(selectedItem) : (
          renderEmptyDetail?.() || (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Select an item to view details</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Tablet: collapsible strip + overlay ─────────────────────────────────

function TabletLayout<T>({
  items, selectedItem, onSelectItem, keyExtractor, renderListItem, renderCompactListItem, renderDetail, renderEmptyDetail, renderListHeader, renderListBody, className, expanded, onToggleExpand, overlayRef,
}: SubLayoutProps<T> & {
  renderCompactListItem?: (item: T, isSelected: boolean) => React.ReactNode
  expanded: boolean
  onToggleExpand: () => void
  overlayRef: React.RefObject<HTMLDivElement>
}) {
  const renderItemButton = (item: T) => {
    const key = keyExtractor(item)
    const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false
    return (
      <button
        key={key}
        onClick={() => onSelectItem(item)}
        className={cn(
          'w-full text-left rounded-xl px-3 py-2.5 min-h-[44px] transition-all duration-200',
          isSelected
            ? 'bg-primary/15 text-primary'
            : 'text-foreground hover:bg-white/50 dark:hover:bg-white/10'
        )}
      >
        {renderListItem(item, isSelected)}
      </button>
    )
  }

  return (
    <div className={cn('flex gap-3 relative', className)}>
      {/* Collapsed strip */}
      <div className="glass rounded-2xl p-2 flex flex-col items-center w-16 shrink-0 overflow-hidden">
        <button
          onClick={onToggleExpand}
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/50 dark:hover:bg-white/10 transition-colors mb-2"
          aria-label={expanded ? 'Collapse list' : 'Expand list'}
        >
          {expanded ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar w-full">
          {items.map((item) => {
            const key = keyExtractor(item)
            const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false
            return (
              <button
                key={key}
                onClick={() => onSelectItem(item)}
                className={cn(
                  'w-full flex items-center justify-center rounded-lg py-2 min-h-[44px] transition-all duration-200 text-xs font-mono font-semibold',
                  isSelected
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground'
                )}
              >
                {renderCompactListItem ? renderCompactListItem(item, isSelected) : renderListItem(item, isSelected)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Expanded overlay */}
      {expanded && (
        <>
          <div className="fixed inset-0 z-10" aria-hidden />
          <div
            ref={overlayRef}
            className="absolute left-16 top-0 bottom-0 w-80 z-20 glass-heavy rounded-2xl p-4 overflow-hidden flex flex-col animate-scale-up"
          >
            {renderListHeader?.()}
            <div className="flex-1 overflow-y-auto mt-3 space-y-1 custom-scrollbar">
              {renderListBody
                ? renderListBody(renderItemButton)
                : items.map(renderItemButton)
              }
            </div>
          </div>
        </>
      )}

      {/* Detail panel */}
      <div className="flex-1 glass rounded-2xl p-5 overflow-hidden min-h-0">
        {selectedItem ? renderDetail(selectedItem) : (
          renderEmptyDetail?.() || (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>Select an item to view details</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ─── Mobile: single panel ────────────────────────────────────────────────

function MobileLayout<T>({
  items, selectedItem, onSelectItem, keyExtractor, renderListItem, renderDetail, renderEmptyDetail, renderListHeader, renderListBody, className, activeView, onBack,
}: SubLayoutProps<T> & {
  activeView: ActiveView
  onBack: () => void
}) {
  const renderItemButton = (item: T) => {
    const key = keyExtractor(item)
    const isSelected = selectedItem ? keyExtractor(selectedItem) === key : false
    return (
      <button
        key={key}
        onClick={() => onSelectItem(item)}
        className={cn(
          'w-full text-left rounded-xl px-3 py-3 min-h-[44px] transition-all duration-200',
          isSelected
            ? 'bg-primary/15 text-primary'
            : 'text-foreground hover:bg-white/50 dark:hover:bg-white/10'
        )}
      >
        {renderListItem(item, isSelected)}
      </button>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* List view */}
      <div
        className={cn(
          'transition-transform duration-300 ease-out',
          activeView === 'detail' ? '-translate-x-full opacity-0 absolute inset-0' : 'translate-x-0'
        )}
      >
        <div className="glass rounded-2xl p-4">
          {renderListHeader?.()}
          <div className="mt-3 space-y-1">
            {renderListBody
              ? renderListBody(renderItemButton)
              : items.map(renderItemButton)
            }
          </div>
        </div>
      </div>

      {/* Detail view */}
      <div
        className={cn(
          'transition-transform duration-300 ease-out',
          activeView === 'list' ? 'translate-x-full opacity-0 absolute inset-0' : 'translate-x-0'
        )}
      >
        <div className="glass rounded-2xl p-4">
          {/* Back button */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 min-h-[44px] min-w-[44px]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to list</span>
          </button>

          {selectedItem ? renderDetail(selectedItem) : (
            renderEmptyDetail?.() || (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <p>Select an item to view details</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
