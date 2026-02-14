'use client'

import { useState, useMemo } from 'react'
import { ServiceType } from '@/types/database'
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
import { ServiceTypeFormDialog } from './service-type-form-dialog'
import { deleteServiceType } from '@/app/actions/service-types'
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

type SortColumn = keyof ServiceType | null
type SortDirection = 'asc' | 'desc'

interface ServiceTypesTableProps {
  serviceTypes: ServiceType[]
}

export function ServiceTypesTable({ serviceTypes }: ServiceTypesTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('code')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editServiceType, setEditServiceType] = useState<ServiceType | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serviceTypeToDelete, setServiceTypeToDelete] = useState<ServiceType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filteredAndSortedServiceTypes = useMemo(() => {
    let filtered = serviceTypes

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (st) =>
          st.code.toLowerCase().includes(query) ||
          st.name.toLowerCase().includes(query) ||
          st.description?.toLowerCase().includes(query)
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
  }, [serviceTypes, searchQuery, sortColumn, sortDirection])

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

  function handleEdit(serviceType: ServiceType) {
    setEditServiceType(serviceType)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditServiceType(null)
    setFormOpen(true)
  }

  function handleDeleteClick(serviceType: ServiceType) {
    setServiceTypeToDelete(serviceType)
    setDeleteDialogOpen(true)
  }

  async function confirmDelete() {
    if (!serviceTypeToDelete) return

    setDeleting(true)
    const result = await deleteServiceType(serviceTypeToDelete.id)

    if (result?.error) {
      alert(`Error deleting service type: ${result.error}`)
    } else {
      router.refresh()
    }

    setDeleting(false)
    setDeleteDialogOpen(false)
    setServiceTypeToDelete(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search service types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredAndSortedServiceTypes.length} of {serviceTypes.length} service types
          </span>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Service Type
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
                  onClick={() => handleSort('description')}
                  className="font-semibold"
                >
                  Description
                  {getSortIcon('description')}
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  onClick={() => handleSort('color')}
                  className="font-semibold"
                >
                  Color
                  {getSortIcon('color')}
                </Button>
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedServiceTypes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No service types found matching your search.' : 'No service types in database.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedServiceTypes.map((st) => (
                <TableRow key={st.id}>
                  <TableCell className="font-mono font-semibold">{st.code}</TableCell>
                  <TableCell>{st.name}</TableCell>
                  <TableCell className="text-muted-foreground">{st.description || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded-full border"
                        style={{ backgroundColor: st.color }}
                      />
                      <span className="font-mono text-sm text-muted-foreground">{st.color}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(st)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(st)}
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
      <ServiceTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        serviceType={editServiceType}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service Type</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {serviceTypeToDelete?.name}? This action cannot be undone.
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
