'use client'

import { useState, useMemo } from 'react'
import { CabinConfiguration, CabinEntry } from '@/types/database'
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
import { CabinConfigurationFormDialog } from './cabin-configuration-form-dialog'
import { deleteCabinConfiguration } from '@/app/actions/cabin-configurations'
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

type SortColumn = 'aircraft_type' | 'name' | 'total_seats' | null
type SortDirection = 'asc' | 'desc'

interface CabinConfigurationsTableProps {
  configurations: CabinConfiguration[]
}

function formatCabinLayout(cabins: CabinEntry[]): string {
  if (!cabins || cabins.length === 0) return '—'
  return cabins.map((c) => `${c.class}${c.seats}`).join(' / ')
}

export function CabinConfigurationsTable({ configurations }: CabinConfigurationsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('aircraft_type')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editConfig, setEditConfig] = useState<CabinConfiguration | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [configToDelete, setConfigToDelete] = useState<CabinConfiguration | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filteredAndSortedConfigs = useMemo(() => {
    let filtered = configurations

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (config) =>
          config.aircraft_type.toLowerCase().includes(query) ||
          config.name.toLowerCase().includes(query)
      )
    }

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn]
        const bVal = b[sortColumn]

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }

        const aStr = String(aVal || '')
        const bStr = String(bVal || '')
        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [configurations, searchQuery, sortColumn, sortDirection])

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

  function handleEdit(config: CabinConfiguration) {
    setEditConfig(config)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditConfig(null)
    setFormOpen(true)
  }

  function handleDeleteClick(config: CabinConfiguration) {
    setConfigToDelete(config)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!configToDelete) return

    setDeleting(true)
    const result = await deleteCabinConfiguration(configToDelete.id)

    if (result?.error) {
      alert(`Error deleting configuration: ${result.error}`)
    } else {
      router.refresh()
    }

    setDeleting(false)
    setDeleteDialogOpen(false)
    setConfigToDelete(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search configurations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredAndSortedConfigs.length} of {configurations.length} configurations
          </span>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Configuration
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
                  onClick={() => handleSort('aircraft_type')}
                  className="font-semibold"
                >
                  Aircraft Type
                  {getSortIcon('aircraft_type')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="font-semibold"
                >
                  Config Name
                  {getSortIcon('name')}
                </Button>
              </TableHead>
              <TableHead>Cabin Layout</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('total_seats')}
                  className="font-semibold"
                >
                  Total Seats
                  {getSortIcon('total_seats')}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedConfigs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No configurations found matching your search.' : 'No cabin configurations in database.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedConfigs.map((config) => (
                <TableRow key={config.id}>
                  <TableCell className="font-mono font-semibold">{config.aircraft_type}</TableCell>
                  <TableCell>{config.name}</TableCell>
                  <TableCell className="font-mono text-sm">{formatCabinLayout(config.cabins)}</TableCell>
                  <TableCell>{config.total_seats}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(config)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(config)}
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
      <CabinConfigurationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        config={editConfig}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Cabin Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the {configToDelete?.name} configuration for {configToDelete?.aircraft_type}? This action cannot be undone.
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
