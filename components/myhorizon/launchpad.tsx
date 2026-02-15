'use client'

import { useState, useCallback } from 'react'
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
import { useUserPreferences, type DashboardShortcut } from '@/hooks/use-user-preferences'
import { ShortcutCard, AddShortcutCard } from './shortcut-card'
import { AddShortcutDialog } from './add-shortcut-dialog'
import { SearchBox } from '@/components/search/search-box'
import { UserMenu } from '@/components/user-menu'
import { Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ModuleEntry } from '@/lib/modules/registry'

interface LaunchpadProps {
  userName: string
  userRole: string
  isAdmin: boolean
  enabledModules: string[]
  currentOperatorId?: string
  operatorLogoUrl?: string | null
}

function formatDate(date: Date): string {
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const day = date.getDate().toString().padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

export function Launchpad({ userName, userRole, isAdmin, enabledModules, currentOperatorId, operatorLogoUrl }: LaunchpadProps) {
  const { preferences, updatePreferences, isLoaded } = useUserPreferences()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const router = useRouter()

  const shortcuts = preferences.dashboard_layout
  const codes = shortcuts.map(s => s.code)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = codes.indexOf(active.id as string)
    const newIndex = codes.indexOf(over.id as string)
    const newOrder = arrayMove(shortcuts, oldIndex, newIndex).map((s, i) => ({ ...s, order: i }))
    updatePreferences({ dashboard_layout: newOrder })
  }, [codes, shortcuts, updatePreferences])

  const handleRemove = useCallback((code: string) => {
    const next = shortcuts
      .filter(s => s.code !== code)
      .map((s, i) => ({ ...s, order: i }))
    updatePreferences({ dashboard_layout: next })
  }, [shortcuts, updatePreferences])

  const handleAdd = useCallback((code: string) => {
    if (codes.includes(code)) return
    const next: DashboardShortcut[] = [
      ...shortcuts,
      { code, order: shortcuts.length },
    ]
    updatePreferences({ dashboard_layout: next })
  }, [codes, shortcuts, updatePreferences])

  const handleSearchSelect = useCallback((mod: ModuleEntry) => {
    if (mod.route) {
      router.push(mod.route)
    }
  }, [router])

  const today = new Date()
  const formattedDate = formatDate(today)

  if (!isLoaded) return null

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
          placeholder="Search module or type code (e.g. Gantt or 2.1.2)..."
          className="w-full"
        />
      </div>

      {/* Shortcut Grid */}
      <div className="animate-fade-up">
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
              <AddShortcutCard onClick={() => setShowAddDialog(true)} />
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
        onAdd={handleAdd}
        onRemove={handleRemove}
      />
    </div>
  )
}
