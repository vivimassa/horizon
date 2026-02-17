'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, X, Search } from 'lucide-react'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  searchable?: boolean
  maxDisplay?: number
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select...',
  searchable = true,
  maxDisplay = 5,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const containerRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  // Close on click outside
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Focus search when opened
  React.useEffect(() => {
    if (open && searchable) {
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open, searchable])

  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter(v => v !== value)
        : [...selected, value]
    )
  }

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter(v => v !== value))
  }

  const displayPills = selected.slice(0, maxDisplay)
  const overflow = selected.length - maxDisplay

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full min-h-[36px] items-center gap-1.5 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors',
          'hover:border-ring/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          open && 'ring-1 ring-ring',
        )}
      >
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground text-sm">{placeholder}</span>
          ) : (
            <>
              {displayPills.map(val => {
                const opt = options.find(o => o.value === val)
                return (
                  <span
                    key={val}
                    className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 text-primary px-1.5 py-0.5 text-[11px] font-medium"
                  >
                    {opt?.value || val}
                    <button
                      type="button"
                      onClick={(e) => remove(val, e)}
                      className="ml-0.5 rounded-sm hover:bg-primary/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {overflow > 0 && (
                <span className="text-[11px] text-muted-foreground font-medium">
                  +{overflow} more
                </span>
              )}
            </>
          )}
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border/50 bg-popover/95 backdrop-blur-xl shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
          {/* Search input */}
          {searchable && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                ref={searchRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* Options list */}
          <div className="max-h-[250px] overflow-y-auto p-1 custom-scrollbar">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">No results</div>
            ) : (
              filtered.map(option => {
                const isSelected = selected.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                      isSelected
                        ? 'bg-primary/[0.08] text-foreground'
                        : 'text-foreground/80 hover:bg-muted/60'
                    )}
                  >
                    <div className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}>
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate text-left">{option.label}</span>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer with count + clear */}
          {selected.length > 0 && (
            <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
              <span className="text-[11px] text-muted-foreground">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
