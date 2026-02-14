'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getModuleByCode } from '@/lib/modules/registry'
import { getIcon } from '@/lib/modules/icons'
import { useState, useRef, useEffect } from 'react'

interface ShortcutCardProps {
  code: string
  onRemove: (code: string) => void
}

export function ShortcutCard({ code, onRemove }: ShortcutCardProps) {
  const mod = getModuleByCode(code)
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    if (showMenu) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMenu])

  if (!mod) return null

  const Icon = getIcon(mod.icon)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group',
        isDragging && 'z-50 opacity-80'
      )}
      onContextMenu={(e) => {
        e.preventDefault()
        setShowMenu(true)
      }}
    >
      <Link
        href={mod.route}
        className={cn(
          'flex flex-col items-center gap-3 p-6 rounded-2xl glass',
          'transition-all duration-300',
          'hover:shadow-glass-lg dark:hover:shadow-none hover:scale-[1.03]',
          'cursor-grab active:cursor-grabbing',
        )}
        {...attributes}
        {...listeners}
        onClick={(e) => {
          // Prevent navigation when dragging
          if (isDragging) e.preventDefault()
        }}
      >
        <div className="p-3 rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-center">
          <div className="font-medium text-sm leading-tight">{mod.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">{mod.code}</div>
        </div>
      </Link>

      {/* Right-click context menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-2 right-2 z-50 min-w-[180px] rounded-xl glass-heavy p-1.5 animate-scale-up"
        >
          <button
            onClick={() => {
              onRemove(code)
              setShowMenu(false)
            }}
            className="w-full text-left text-sm px-3 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          >
            Remove from myHorizon
          </button>
        </div>
      )}
    </div>
  )
}

interface AddCardProps {
  onClick: () => void
}

export function AddShortcutCard({ onClick }: AddCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl',
        'border-2 border-dashed border-muted-foreground/20',
        'text-muted-foreground hover:text-foreground hover:border-primary/40',
        'transition-all duration-300 hover:scale-[1.03]',
        'min-h-[140px]'
      )}
    >
      <div className="h-6 w-6 flex items-center justify-center text-2xl font-light">+</div>
      <span className="text-xs font-medium">Add shortcut</span>
    </button>
  )
}
