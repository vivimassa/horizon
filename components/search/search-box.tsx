'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import Fuse from 'fuse.js'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODULE_REGISTRY, type ModuleEntry } from '@/lib/modules/registry'
import { getIcon } from '@/lib/modules/icons'

interface SearchResult extends ModuleEntry {
  fuseScore?: number
}

interface SearchBoxProps {
  onSelect: (mod: ModuleEntry) => void
  onPin?: (mod: ModuleEntry) => void
  showPin?: boolean
  placeholder?: string
  className?: string
  autoFocus?: boolean
}

export function SearchBox({ onSelect, onPin, showPin = false, placeholder = 'Search modules...', className, autoFocus = false }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Leaf modules only for searching (level 2 items + level 1 sections)
  const searchable = useMemo(
    () => MODULE_REGISTRY.filter(m => m.level >= 1),
    []
  )

  const fuse = useMemo(
    () => new Fuse(searchable, {
      keys: ['name', 'description', 'code'],
      threshold: 0.4,
      includeScore: true,
    }),
    [searchable]
  )

  const doSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([])
      setIsOpen(false)
      return
    }

    // Code-based search: strip dots and match
    const stripped = q.replace(/\./g, '')
    const codeMatches = searchable.filter(m => {
      const mStripped = m.code.replace(/\./g, '')
      return mStripped.startsWith(stripped) || mStripped === stripped
    })

    if (codeMatches.length > 0 && /^\d/.test(q)) {
      setResults(codeMatches.slice(0, 10))
    } else {
      // Fuzzy name search
      const fuseResults = fuse.search(q).slice(0, 10)
      setResults(fuseResults.map(r => ({ ...r.item, fuseScore: r.score })))
    }
    setSelectedIndex(0)
    setIsOpen(true)
  }, [fuse, searchable])

  useEffect(() => {
    doSearch(query)
  }, [query, doSearch])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Scroll selected into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const el = listRef.current.children[selectedIndex] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onSelect(results[selectedIndex])
      setQuery('')
      setIsOpen(false)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (query.trim()) setIsOpen(true) }}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-10 pr-4 py-2.5 rounded-xl text-sm',
            'glass',
            'outline-none focus:ring-2 focus:ring-primary/30',
            'placeholder:text-muted-foreground/50',
          )}
        />
      </div>

      {isOpen && results.length > 0 && (
        <div
          ref={listRef}
          className="absolute top-full mt-2 w-full rounded-xl glass-heavy overflow-hidden z-50 max-h-[320px] overflow-y-auto animate-scale-up"
        >
          {results.map((mod, i) => {
            const Icon = getIcon(mod.icon)
            return (
              <button
                key={mod.code}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(mod)
                  setQuery('')
                  setIsOpen(false)
                }}
                className={cn(
                  'flex items-center gap-3 w-full px-4 py-2.5 text-left text-sm transition-colors',
                  i === selectedIndex ? 'bg-primary/10 text-primary' : 'hover:bg-white/30 dark:hover:bg-white/5'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{mod.name}</span>
                  <span className="text-xs text-muted-foreground ml-2 truncate">{mod.description}</span>
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0">{mod.code}</span>
                {showPin && onPin && (
                  <button
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onPin(mod)
                    }}
                    className="ml-1 p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                    title="Pin to myHorizon"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="17" x2="12" y2="22" />
                      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                    </svg>
                  </button>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
