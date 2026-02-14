'use client'

import { useState, useMemo } from 'react'
import { ScheduleSeason } from '@/types/database'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScheduleSeasonFormDialog } from './schedule-season-form-dialog'
import { deleteScheduleSeason } from '@/app/actions/schedule-seasons'
import { useRouter } from 'next/navigation'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Pencil,
  Trash2,
  Search,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type SortColumn = keyof ScheduleSeason | null
type SortDirection = 'asc' | 'desc'

interface ScheduleSeasonsTableProps {
  seasons: ScheduleSeason[]
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'border border-input bg-background',
    published: 'bg-blue-500/10 text-blue-500',
    active: 'bg-green-500/10 text-green-500',
    archived: 'bg-secondary text-secondary-foreground',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.draft}`}>
      {status}
    </span>
  )
}

export function ScheduleSeasonsTable({ seasons }: ScheduleSeasonsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('start_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [formOpen, setFormOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<ScheduleSeason | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [seasonToDelete, setSeasonToDelete] = useState<ScheduleSeason | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filteredAndSortedSeasons = useMemo(() => {
    let filtered = seasons

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (season) =>
          season.code.toLowerCase().includes(query) ||
          season.name.toLowerCase().includes(query) ||
          season.status.toLowerCase().includes(query)
      )
    }

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn] || ''
        const bVal = b[sortColumn] || ''

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [seasons, searchQuery, sortColumn, sortDirection])

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function getSortIcon(column: SortColumn) {
    if (sortColumn !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    )
  }

  function handleEdit(season: ScheduleSeason) {
    setEditSeason(season)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditSeason(null)
    setFormOpen(true)
  }

  function handleDeleteClick(season: ScheduleSeason) {
    setSeasonToDelete(season)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!seasonToDelete) return

    setDeleting(true)
    const result = await deleteScheduleSeason(seasonToDelete.id)

    if (result?.error) {
      alert(`Error deleting season: ${result.error}`)
    } else {
      router.refresh()
    }

    setDeleting(false)
    setDeleteDialogOpen(false)
    setSeasonToDelete(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search seasons..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredAndSortedSeasons.length} of {seasons.length} seasons
          </span>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Season
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('code')}
                  className="font-semibold"
                >
                  Code
                  {getSortIcon('code')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="font-semibold"
                >
                  Name
                  {getSortIcon('name')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('start_date')}
                  className="font-semibold"
                >
                  Start Date
                  {getSortIcon('start_date')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('end_date')}
                  className="font-semibold"
                >
                  End Date
                  {getSortIcon('end_date')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('status')}
                  className="font-semibold"
                >
                  Status
                  {getSortIcon('status')}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedSeasons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No seasons found matching your search.' : 'No schedule seasons in database.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedSeasons.map((season) => (
                <TableRow key={season.id}>
                  <TableCell className="font-mono font-semibold">{season.code}</TableCell>
                  <TableCell>{season.name}</TableCell>
                  <TableCell>{season.start_date}</TableCell>
                  <TableCell>{season.end_date}</TableCell>
                  <TableCell><StatusBadge status={season.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(season)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(season)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <ScheduleSeasonFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        season={editSeason}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Schedule Season</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {seasonToDelete?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
