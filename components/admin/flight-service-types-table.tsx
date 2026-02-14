'use client'

import { useState, useMemo } from 'react'
import { FlightServiceType } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FlightServiceTypeFormDialog } from './flight-service-type-form-dialog'
import { deleteFlightServiceType } from '@/app/actions/flight-service-types'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortColumn = 'code' | 'name' | null
type SortDirection = 'asc' | 'desc'

interface FlightServiceTypesTableProps {
  serviceTypes: FlightServiceType[]
}

export function FlightServiceTypesTable({ serviceTypes }: FlightServiceTypesTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('code')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<FlightServiceType | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<FlightServiceType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filtered = useMemo(() => {
    let items = serviceTypes
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(s => s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q))
    }
    if (sortColumn) {
      items = [...items].sort((a, b) => {
        const aVal = a[sortColumn] || ''; const bVal = b[sortColumn] || ''
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [serviceTypes, searchQuery, sortColumn, sortDirection])

  function handleSort(col: SortColumn) {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortColumn(col); setSortDirection('asc') }
  }

  function getSortIcon(col: SortColumn) {
    if (sortColumn !== col) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  async function confirmDelete() {
    if (!itemToDelete) return
    setDeleting(true)
    const result = await deleteFlightServiceType(itemToDelete.id)
    if (result?.error) alert(`Error: ${result.error}`)
    else router.refresh()
    setDeleting(false); setDeleteDialogOpen(false); setItemToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search service types..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} of {serviceTypes.length} types</span>
          <Button onClick={() => { setEditItem(null); setFormOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Service Type</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Button variant="ghost" onClick={() => handleSort('code')} className="font-semibold">Code{getSortIcon('code')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="font-semibold">Name{getSortIcon('name')}</Button></TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{searchQuery ? 'No service types found matching your search.' : 'No flight service types in database.'}</TableCell></TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-mono font-semibold">{s.code}</TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell className="text-muted-foreground">{s.description || '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full border" style={{ backgroundColor: s.color || '#6B9DAD' }} />
                    <span className="font-mono text-sm text-muted-foreground">{s.color || '—'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.is_active ? 'bg-green-500/10 text-green-500' : 'bg-secondary text-secondary-foreground'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditItem(s); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setItemToDelete(s); setDeleteDialogOpen(true) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <FlightServiceTypeFormDialog open={formOpen} onOpenChange={setFormOpen} serviceType={editItem} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Service Type</DialogTitle><DialogDescription>Are you sure you want to delete {itemToDelete?.name}? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
