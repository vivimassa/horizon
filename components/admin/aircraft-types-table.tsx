'use client'

import { useState, useMemo } from 'react'
import { AircraftType } from '@/types/database'
import { minutesToHHMM } from '@/lib/utils'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AircraftTypeFormDialog } from './aircraft-type-form-dialog'
import { deleteAircraftType } from '@/app/actions/aircraft-types'
import { useRouter } from 'next/navigation'
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortColumn = 'icao_type' | 'name' | 'family' | 'category' | 'pax_capacity' | 'tat_dom_dom_minutes' | null
type SortDirection = 'asc' | 'desc'

interface AircraftTypesTableProps {
  aircraftTypes: AircraftType[]
}

function formatCabinConfig(config: unknown): string {
  if (!config || typeof config !== 'object' || Object.keys(config).length === 0) return '—'
  return Object.entries(config as Record<string, number>).map(([cls, seats]) => `${cls}${seats}`).join(' / ')
}

export function AircraftTypesTable({ aircraftTypes }: AircraftTypesTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('icao_type')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<AircraftType | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<AircraftType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filtered = useMemo(() => {
    let items = aircraftTypes
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(t =>
        t.icao_type.toLowerCase().includes(q) ||
        t.iata_type?.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q) ||
        (t.family || '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    }
    if (sortColumn) {
      items = [...items].sort((a, b) => {
        const aVal = a[sortColumn] ?? ''
        const bVal = b[sortColumn] ?? ''
        if (typeof aVal === 'number' && typeof bVal === 'number') return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        const aStr = String(aVal), bStr = String(bVal)
        if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1
        if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [aircraftTypes, searchQuery, sortColumn, sortDirection])

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
    const result = await deleteAircraftType(itemToDelete.id)
    if (result?.error) alert(`Error: ${result.error}`)
    else router.refresh()
    setDeleting(false); setDeleteDialogOpen(false); setItemToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search aircraft types..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} of {aircraftTypes.length} types</span>
          <Button onClick={() => { setEditItem(null); setFormOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Type</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Button variant="ghost" onClick={() => handleSort('icao_type')} className="font-semibold">ICAO{getSortIcon('icao_type')}</Button></TableHead>
              <TableHead>IATA</TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="font-semibold">Name{getSortIcon('name')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('category')} className="font-semibold">Category{getSortIcon('category')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('pax_capacity')} className="font-semibold">Pax{getSortIcon('pax_capacity')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('tat_dom_dom_minutes')} className="font-semibold">TAT (D→D){getSortIcon('tat_dom_dom_minutes')}</Button></TableHead>
              <TableHead>Cabin Config</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">{searchQuery ? 'No types found matching your search.' : 'No aircraft types in database.'}</TableCell></TableRow>
            ) : filtered.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-mono font-semibold">{t.icao_type}</TableCell>
                <TableCell className="font-mono">{t.iata_type || '—'}</TableCell>
                <TableCell>{t.name}</TableCell>
                <TableCell><span className="text-xs bg-secondary px-2 py-0.5 rounded">{t.category}</span></TableCell>
                <TableCell>{t.pax_capacity}</TableCell>
                <TableCell className="font-mono">{minutesToHHMM(t.tat_dom_dom_minutes) || minutesToHHMM(t.default_tat_minutes) || '—'}</TableCell>
                <TableCell className="font-mono text-sm">{formatCabinConfig(t.default_cabin_config)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditItem(t); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => { setItemToDelete(t); setDeleteDialogOpen(true) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AircraftTypeFormDialog open={formOpen} onOpenChange={setFormOpen} aircraftType={editItem} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Aircraft Type</DialogTitle>
            <DialogDescription>Are you sure you want to delete {itemToDelete?.name}? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
