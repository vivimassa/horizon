'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getModuleTree, isLeafModule, type ModuleTreeNode } from '@/lib/modules/registry'
import { getIcon } from '@/lib/modules/icons'
import { cn } from '@/lib/utils'
import { Check, Pin } from 'lucide-react'
import { getModuleColorByCode } from '@/lib/modules/colors'

interface AddShortcutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  enabledModules: string[]
  pinnedCodes: string[]
  onAdd: (code: string) => void
  onRemove: (code: string) => void
}

export function AddShortcutDialog({
  open,
  onOpenChange,
  enabledModules,
  pinnedCodes,
  onAdd,
  onRemove,
}: AddShortcutDialogProps) {
  const tree = getModuleTree()

  const hasAccess = (node: ModuleTreeNode): boolean => {
    if (!node.required_module) return true
    return enabledModules.includes(node.required_module)
  }

  const renderLeafItem = (node: ModuleTreeNode) => {
    const isPinned = pinnedCodes.includes(node.code)
    const accessible = hasAccess(node)
    const Icon = getIcon(node.icon)
    const color = getModuleColorByCode(node.code)

    return (
      <button
        key={node.code}
        disabled={!accessible}
        onClick={() => {
          if (isPinned) {
            onRemove(node.code)
          } else {
            onAdd(node.code)
          }
        }}
        className={cn(
          'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors',
          accessible
            ? isPinned
              ? color
                ? `${color.bg} ${color.text}`
                : 'bg-primary/10 text-primary'
              : 'hover:bg-white/50 dark:hover:bg-white/10 text-foreground'
            : 'opacity-40 cursor-not-allowed'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{node.name}</div>
          <div className="text-xs text-muted-foreground truncate">{node.description}</div>
        </div>
        <span className="text-xs font-mono text-muted-foreground shrink-0">{node.code}</span>
        {isPinned ? (
          <Check className={cn('h-4 w-4 shrink-0', color ? color.text : 'text-primary')} />
        ) : accessible ? (
          <Pin className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        ) : null}
      </button>
    )
  }

  /** Recursively render children — leaf nodes get buttons, parents get sub-headers */
  const renderChildren = (children: ModuleTreeNode[], depth: number = 0) => {
    return children.map(child => {
      if (!hasAccess(child)) return null

      const isLeaf = isLeafModule(child.code)

      if (isLeaf) {
        return renderLeafItem(child)
      }

      // Parent node — render as sub-section header with its children
      return (
        <div key={child.code} className="space-y-0.5">
          <div className={cn(
            'text-xs font-medium text-muted-foreground/80 px-3 pt-1',
            depth > 0 && 'pl-6'
          )}>
            {child.code} {child.name}
          </div>
          {renderChildren(child.children, depth + 1)}
        </div>
      )
    })
  }

  const renderSection = (node: ModuleTreeNode) => {
    if (!hasAccess(node)) return null

    return (
      <div key={node.code} className="space-y-1">
        {/* Section header */}
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-3 pb-1">
          {node.code} {node.name}
        </div>
        {renderChildren(node.children)}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-heavy max-w-lg max-h-[70vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to myHorizon</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          {tree.map(root => renderSection(root))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
