'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { getModuleByCode } from '@/lib/modules/registry'
import { getIcon } from '@/lib/modules/icons'
import { X, GripVertical } from 'lucide-react'
import { getModuleColorByCode } from '@/lib/modules/colors'

interface ShortcutCardProps {
  code: string
  onRemove: (code: string) => void
}

export function ShortcutCard({ code, onRemove }: ShortcutCardProps) {
  const mod = getModuleByCode(code)

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  if (!mod) return null

  const Icon = getIcon(mod.icon)
  const color = getModuleColorByCode(code)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group/card',
        isDragging && 'z-50'
      )}
    >
      <Link
        href={mod.route}
        className={cn(
          'flex flex-col items-center gap-3 p-6 rounded-2xl glass',
          'transition-all duration-300',
          'hover:shadow-glass-lg dark:hover:shadow-none hover:scale-[1.03]',
          isDragging && 'opacity-70 rotate-[2deg] scale-105 shadow-xl',
          color?.cardBg,
        )}
        style={color ? { borderColor: `hsl(${color.hsl} / 0.15)` } : undefined}
        onClick={(e) => {
          if (isDragging) e.preventDefault()
        }}
      >
        <div
          className={cn('p-3 rounded-xl', color ? color.text : 'bg-primary/10 text-primary')}
          style={color ? { backgroundColor: `hsl(${color.hsl} / 0.15)` } : undefined}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="text-center">
          <div className="font-medium text-sm leading-tight">{mod.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono">{mod.code}</div>
        </div>
      </Link>

      {/* Remove button — top-right, appears on hover */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(code)
        }}
        className={cn(
          'absolute top-2 right-2 p-1.5 rounded-lg',
          'opacity-0 group-hover/card:opacity-100',
          'bg-destructive/10 hover:bg-destructive/20 text-destructive',
          'transition-all duration-200',
          'z-10'
        )}
        title="Remove shortcut"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Drag handle — bottom-right, appears on hover */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
          'absolute bottom-2 right-2 p-1.5 rounded-lg',
          'opacity-0 group-hover/card:opacity-100',
          'hover:bg-white/50 dark:hover:bg-white/10 text-muted-foreground',
          'transition-all duration-200 cursor-grab active:cursor-grabbing',
          'z-10'
        )}
        title="Drag to rearrange"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

interface AddCardProps {
  onClick: () => void
  isDropTarget?: boolean
}

export function AddShortcutCard({ onClick, isDropTarget = false }: AddCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-2 p-6 rounded-2xl',
        'border-2 border-dashed',
        'transition-all duration-300 hover:scale-[1.03]',
        'min-h-[140px]',
        isDropTarget
          ? 'border-primary/60 bg-primary/5 text-primary shadow-[0_0_20px_rgba(var(--primary-rgb,59,130,246),0.15)] scale-[1.03]'
          : 'border-muted-foreground/20 text-muted-foreground hover:text-foreground hover:border-primary/40',
      )}
    >
      <div className="h-6 w-6 flex items-center justify-center text-2xl font-light">+</div>
      <span className="text-xs font-medium">
        {isDropTarget ? 'Drop here to add' : 'Add shortcut'}
      </span>
    </button>
  )
}
