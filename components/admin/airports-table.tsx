'use client'

import { useState, useMemo } from 'react'
import { Airport } from '@/types/database'
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
import { AirportFormDialog } from './airport-form-dialog'
import { deleteAirport } from '@/app/actions/airports'
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

type SortColumn = keyof Airport | null
type SortDirection = 'asc' | 'desc'

interface AirportsTableProps {
  airports: Airport[]
}

export function AirportsTable({ airports }: AirportsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('icao_code')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editAirport, setEditAirport] = useState<Airport | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [airportToDelete, setAirportToDelete] = useState<Airport | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  // Filter and sort airports
  const filteredAndSortedAirports = useMemo(() => {
    let filtered = airports

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (airport) =>
          airport.icao_code.toLowerCase().includes(query) ||
          airport.iata_code?.toLowerCase().includes(query) ||
          airport.name.toLowerCase().includes(query) ||
          airport.city?.toLowerCase().includes(query) ||
          airport.country?.toLowerCase().includes(query)
      )
    }

    // Sort
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
  }, [airports, searchQuery, sortColumn, sortDirection])

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

  function handleEdit(airport: Airport) {
    setEditAirport(airport)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditAirport(null)
    setFormOpen(true)
  }

  function handleDeleteClick(airport: Airport) {
    setAirportToDelete(airport)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!airportToDelete) return

    setDeleting(true)
    const result = await deleteAirport(airportToDelete.id)

    if (result?.error) {
      alert(`Error deleting airport: ${result.error}`)
    } else {
      router.refresh()
    }

    setDeleting(false)
    setDeleteDialogOpen(false)
    setAirportToDelete(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search airports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredAndSortedAirports.length} of {airports.length} airports
          </span>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Airport
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
                  onClick={() => handleSort('icao_code')}
                  className="font-semibold"
                >
                  ICAO Code
                  {getSortIcon('icao_code')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('iata_code')}
                  className="font-semibold"
                >
                  IATA Code
                  {getSortIcon('iata_code')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('name')}
                  className="font-semibold"
                >
                  Airport Name
                  {getSortIcon('name')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('city')}
                  className="font-semibold"
                >
                  City
                  {getSortIcon('city')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('country')}
                  className="font-semibold"
                >
                  Country
                  {getSortIcon('country')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('timezone')}
                  className="font-semibold"
                >
                  Timezone
                  {getSortIcon('timezone')}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedAirports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No airports found matching your search.' : 'No airports in database.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedAirports.map((airport) => (
                <TableRow key={airport.id}>
                  <TableCell className="font-mono font-semibold">{airport.icao_code}</TableCell>
                  <TableCell className="font-mono">{airport.iata_code || '—'}</TableCell>
                  <TableCell>{airport.name}</TableCell>
                  <TableCell>{airport.city}</TableCell>
                  <TableCell>{airport.country}</TableCell>
                  <TableCell className="font-mono text-sm">{airport.timezone}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(airport)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(airport)}
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
      <AirportFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        airport={editAirport}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Airport</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {airportToDelete?.name}? This action cannot be undone.
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
