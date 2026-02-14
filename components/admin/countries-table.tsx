'use client'

import { useState, useMemo } from 'react'
import { Country } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CountryFormDialog } from './country-form-dialog'
import { deleteCountry } from '@/app/actions/countries'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortColumn = keyof Country | null
type SortDirection = 'asc' | 'desc'

export function CountriesTable({ countries }: { countries: Country[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editCountry, setEditCountry] = useState<Country | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [countryToDelete, setCountryToDelete] = useState<Country | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filteredAndSortedCountries = useMemo(() => {
    let filtered = countries
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(c =>
        c.iso_code_2.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        (c.region || '').toLowerCase().includes(query) ||
        (c.currency_code || '').toLowerCase().includes(query)
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
  }, [countries, searchQuery, sortColumn, sortDirection])

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  function getSortIcon(column: SortColumn) {
    if (sortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
  }

  async function confirmDelete() {
    if (!countryToDelete) return
    setDeleting(true)
    const result = await deleteCountry(countryToDelete.id)
    if (result?.error) alert(`Error: ${result.error}`)
    else router.refresh()
    setDeleting(false)
    setDeleteDialogOpen(false)
    setCountryToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search countries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {filteredAndSortedCountries.length} of {countries.length} countries
          </span>
          <Button onClick={() => { setEditCountry(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Country
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Button variant="ghost" onClick={() => handleSort('iso_code_2')} className="font-semibold">ISO Code{getSortIcon('iso_code_2')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('name')} className="font-semibold">Name{getSortIcon('name')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('region')} className="font-semibold">Region{getSortIcon('region')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('currency_code')} className="font-semibold">Currency{getSortIcon('currency_code')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('icao_prefix')} className="font-semibold">ICAO Prefix{getSortIcon('icao_prefix')}</Button></TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCountries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No countries found.' : 'No countries in database.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCountries.map((country) => (
                <TableRow key={country.id}>
                  <TableCell className="font-mono font-semibold">{country.iso_code_2}</TableCell>
                  <TableCell>{country.name}</TableCell>
                  <TableCell>{country.region}</TableCell>
                  <TableCell className="font-mono">{country.currency_code}</TableCell>
                  <TableCell className="font-mono">{country.icao_prefix}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditCountry(country); setFormOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setCountryToDelete(country); setDeleteDialogOpen(true); }}>
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

      <CountryFormDialog open={formOpen} onOpenChange={setFormOpen} country={editCountry} />
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Country</DialogTitle>
            <DialogDescription>Are you sure you want to delete {countryToDelete?.name}?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
