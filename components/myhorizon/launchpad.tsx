'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { ShortcutCard, AddShortcutCard } from './shortcut-card'
import { AddShortcutDialog } from './add-shortcut-dialog'
import { SearchBox } from '@/components/search/search-box'
import { UserMenu } from '@/components/user-menu'
import { Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ModuleEntry, isLeafModule, getModuleByCode } from '@/lib/modules/registry'
import {
  addShortcut,
  removeShortcut,
  reorderShortcuts,
  type UserShortcut,
} from '@/app/actions/shortcuts'
import { toast } from 'sonner'

interface LaunchpadProps {
  userName: string
  userRole: string
  isAdmin: boolean
  enabledModules: string[]
  currentOperatorId?: string
  operatorLogoUrl?: string | null
  initialShortcuts: UserShortcut[]
}

function formatDate(date: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const day = date.getDate().toString().padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export function Launchpad({ userName, userRole, isAdmin, enabledModules, currentOperatorId, operatorLogoUrl, initialShortcuts }: LaunchpadProps) {
  const [shortcuts, setShortcuts] = useState<UserShortcut[]>(initialShortcuts)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const router = useRouter()
  const gridRef = useRef<HTMLDivElement>(null)

  const codes = shortcuts.map(s => s.page_code)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ─── DnD Kit: Reorder shortcuts ──────────────────────────────────

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = codes.indexOf(active.id as string)
    const newIndex = codes.indexOf(over.id as string)
    const newOrder = arrayMove(shortcuts, oldIndex, newIndex).map((s, i) => ({ ...s, position: i }))

    // Optimistic update
    setShortcuts(newOrder)

    // Persist
    await reorderShortcuts(newOrder.map(s => s.page_code))
  }, [codes, shortcuts])

  // ─── Remove shortcut ────────────────────────────────────────────

  const handleRemove = useCallback(async (code: string) => {
    // Optimistic update
    setShortcuts(prev => prev.filter(s => s.page_code !== code).map((s, i) => ({ ...s, position: i })))

    await removeShortcut(code)
    toast('Shortcut removed')
  }, [])

  // ─── Add shortcut ───────────────────────────────────────────────

  const handleAdd = useCallback(async (mod: ModuleEntry) => {
    if (codes.includes(mod.code)) {
      toast(`${mod.name} is already on your dashboard`)
      return
    }

    if (!isLeafModule(mod.code)) return

    // Optimistic update
    const newShortcut: UserShortcut = {
      id: crypto.randomUUID(),
      page_code: mod.code,
      page_name: mod.name,
      page_path: mod.route,
      page_icon: mod.icon,
      position: shortcuts.length,
    }
    setShortcuts(prev => [...prev, newShortcut])

    // Persist
    const result = await addShortcut({
      pageCode: mod.code,
      pageName: mod.name,
      pagePath: mod.route,
      pageIcon: mod.icon,
    })

    if (result.success && result.shortcut) {
      // Replace optimistic with server version
      setShortcuts(prev =>
        prev.map(s => s.id === newShortcut.id ? result.shortcut! : s)
      )
      toast(`Added ${mod.name} to your dashboard`)
    }
  }, [codes, shortcuts.length])

  const handleAddByCode = useCallback((code: string) => {
    const mod = getModuleByCode(code)
    if (mod) handleAdd(mod)
  }, [handleAdd])

  const handleRemoveByCode = useCallback((code: string) => {
    handleRemove(code)
  }, [handleRemove])

  // ─── Search handlers ────────────────────────────────────────────

  const handleSearchSelect = useCallback((mod: ModuleEntry) => {
    if (mod.route) {
      router.push(mod.route)
    }
  }, [router])

  const handleDragAdd = useCallback((mod: ModuleEntry) => {
    if (!isLeafModule(mod.code)) return
    handleAdd(mod)
  }, [handleAdd])

  // ─── HTML5 Drag: Drop zone for search result drags ──────────────

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const handleDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('application/horizon-shortcut')) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setIsDropTarget(true)
      }
    }

    const handleDragLeave = (e: DragEvent) => {
      // Only handle if leaving the grid entirely
      if (!grid.contains(e.relatedTarget as Node)) {
        setIsDropTarget(false)
      }
    }

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault()
      setIsDropTarget(false)

      const data = e.dataTransfer?.getData('application/horizon-shortcut')
      if (!data) return

      try {
        const { code, name, path, icon } = JSON.parse(data)
        const mod: ModuleEntry = {
          code,
          name,
          route: path,
          icon,
          description: '',
          parent_module: null,
          parent_code: null,
          required_module: null,
          level: 2,
        }
        handleAdd(mod)
      } catch {
        // ignore parse errors
      }
    }

    grid.addEventListener('dragover', handleDragOver)
    grid.addEventListener('dragleave', handleDragLeave)
    grid.addEventListener('drop', handleDrop)

    return () => {
      grid.removeEventListener('dragover', handleDragOver)
      grid.removeEventListener('dragleave', handleDragLeave)
      grid.removeEventListener('drop', handleDrop)
    }
  }, [handleAdd])

  const today = new Date()
  const formattedDate = formatDate(today)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight mb-1">
              my<span className="text-primary">Horizon</span>
            </h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-lg font-mono">{formattedDate}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {operatorLogoUrl && (
              <img
                src={operatorLogoUrl}
                alt="Operator logo"
                className="h-10 w-auto object-contain"
              />
            )}
            <UserMenu
              userName={userName}
              userRole={userRole}
              isAdmin={isAdmin}
              currentOperatorId={currentOperatorId}
            />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="animate-fade-in">
        <SearchBox
          onSelect={handleSearchSelect}
          onDragAdd={handleDragAdd}
          placeholder="Search module or type code (e.g. Gantt or 2.1.2)..."
          className="w-full"
        />
      </div>

      {/* Shortcut Grid */}
      <div className="animate-fade-up" ref={gridRef}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={codes} strategy={rectSortingStrategy}>
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {codes.map(code => (
                <ShortcutCard key={code} code={code} onRemove={handleRemove} />
              ))}
              <AddShortcutCard onClick={() => setShowAddDialog(true)} isDropTarget={isDropTarget} />
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Add Shortcut Dialog */}
      <AddShortcutDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        enabledModules={enabledModules}
        pinnedCodes={codes}
        onAdd={handleAddByCode}
        onRemove={handleRemoveByCode}
      />
    </div>
  )
}
