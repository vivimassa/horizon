'use client'

import { useState, useMemo } from 'react'
import { AircraftType, Airport } from '@/types/database'
import { AircraftWithType, deleteAircraftRegistration } from '@/app/actions/aircraft-registrations'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AircraftRegistrationFormDialog } from './aircraft-registration-form-dialog'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortColumn = 'registration' | 'status' | null
type SortDirection = 'asc' | 'desc'

interface AircraftRegistrationsTableProps {
  aircraft: AircraftWithType[]
  aircraftTypes: AircraftType[]
  airports: Airport[]
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-500/10 text-green-500',
    maintenance: 'bg-yellow-500/10 text-yellow-500',
    stored: 'bg-secondary text-secondary-foreground',
    retired: 'bg-red-500/10 text-red-500',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.active}`}>
      {status}
    </span>
  )
}

export function AircraftRegistrationsTable({ aircraft, aircraftTypes, airports }: AircraftRegistrationsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('registration')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<AircraftWithType | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<AircraftWithType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filtered = useMemo(() => {
    let items = aircraft
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(a =>
        a.registration.toLowerCase().includes(q) ||
        a.aircraft_types?.icao_type.toLowerCase().includes(q) ||
        a.aircraft_types?.name.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q) ||
        a.airports?.icao_code.toLowerCase().includes(q)
      )
    }
    if (sortColumn) {
      items = [...items].sort((a, b) => {
        const aVal = a[sortColumn] || ''
        const bVal = b[sortColumn] || ''
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [aircraft, searchQuery, sortColumn, sortDirection])

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
    const result = await deleteAircraftRegistration(itemToDelete.id)
    if (result?.error) alert(`Error: ${result.error}`)
    else router.refresh()
    setDeleting(false); setDeleteDialogOpen(false); setItemToDelete(null)
  }

  function formatSeatingConfig(config: Record<string, number> | null): string {
    if (!config || Object.keys(config).length === 0) return 'Type default'
    return Object.entries(config).map(([cls, seats]) => `${cls}${seats}`).join(' / ')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search aircraft..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} of {aircraft.length} aircraft</span>
          <Button onClick={() => { setEditItem(null); setFormOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Aircraft</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Button variant="ghost" onClick={() => handleSort('registration')} className="font-semibold">Registration{getSortIcon('registration')}</Button></TableHead>
              <TableHead>Type</TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('status')} className="font-semibold">Status{getSortIcon('status')}</Button></TableHead>
              <TableHead>Home Base</TableHead>
              <TableHead>Cabin Config</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{searchQuery ? 'No aircraft found matching your search.' : 'No aircraft registrations in database.'}</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-mono font-semibold">{a.registration}</TableCell>
                <TableCell className="font-mono">{a.aircraft_types?.icao_type || '—'}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="font-mono">{a.airports?.icao_code || '—'}</TableCell>
                <TableCell className="font-mono text-sm">{formatSeatingConfig(a.seating_config)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditItem(a); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setItemToDelete(a); setDeleteDialogOpen(true) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AircraftRegistrationFormDialog open={formOpen} onOpenChange={setFormOpen} aircraft={editItem} aircraftTypes={aircraftTypes} airports={airports} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Aircraft</DialogTitle><DialogDescription>Are you sure you want to delete {itemToDelete?.registration}? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
