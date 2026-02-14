'use client'

import { useState, useMemo } from 'react'
import { DelayCode } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DelayCodeFormDialog } from './delay-code-form-dialog'
import { deleteDelayCode } from '@/app/actions/delay-codes'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortDirection = 'asc' | 'desc'

interface DelayCodesTableProps {
  delayCodes: DelayCode[]
}

const CATEGORY_LABELS: Record<string, string> = {
  airline_internal: 'Airline Internal',
  passenger: 'Passenger & Baggage',
  cargo: 'Cargo',
  mail: 'Mail',
  aircraft_ramp: 'Aircraft & Ramp',
  technical: 'Technical',
  operations: 'Operations & Crewing',
  weather: 'Weather',
  atc: 'ATC / ATFM',
  airport: 'Airport',
  government: 'Government',
  reactionary: 'Reactionary',
  miscellaneous: 'Miscellaneous',
}

export function DelayCodesTable({ delayCodes }: DelayCodesTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<DelayCode | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<DelayCode | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const categories = useMemo(() => {
    const cats = new Set(delayCodes.map(d => d.category))
    return Array.from(cats).sort()
  }, [delayCodes])

  const filtered = useMemo(() => {
    let items = delayCodes
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      items = items.filter(d =>
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.description?.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q)
      )
    }
    if (categoryFilter) {
      items = items.filter(d => d.category === categoryFilter)
    }
    items = [...items].sort((a, b) => {
      if (a.code < b.code) return sortDirection === 'asc' ? -1 : 1
      if (a.code > b.code) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    return items
  }, [delayCodes, searchQuery, categoryFilter, sortDirection])

  const grouped = useMemo(() => {
    const map = new Map<string, DelayCode[]>()
    for (const d of filtered) {
      const arr = map.get(d.category) || []
      arr.push(d)
      map.set(d.category, arr)
    }
    return map
  }, [filtered])

  function toggleCategory(cat: string) {
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  async function confirmDelete() {
    if (!itemToDelete) return
    setDeleting(true)
    const result = await deleteDelayCode(itemToDelete.id)
    if (result?.error) alert(`Error: ${result.error}`)
    else router.refresh()
    setDeleting(false); setDeleteDialogOpen(false); setItemToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search delay codes..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c] || c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{filtered.length} of {delayCodes.length} codes</span>
          <Button onClick={() => { setEditItem(null); setFormOpen(true) }}><Plus className="h-4 w-4 mr-2" />Add Code</Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">
                <Button variant="ghost" onClick={() => setSortDirection(d => d === 'asc' ? 'desc' : 'asc')} className="font-semibold">
                  Code{sortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />}
                </Button>
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{searchQuery || categoryFilter ? 'No delay codes found matching your search.' : 'No delay codes in database.'}</TableCell></TableRow>
            ) : (
              Array.from(grouped.entries()).map(([category, codes]) => (
                <>{/* Category group header */}
                  <TableRow key={`cat-${category}`} className="bg-muted/50 hover:bg-muted/70 cursor-pointer" onClick={() => toggleCategory(category)}>
                    <TableCell colSpan={5} className="py-2">
                      <div className="flex items-center gap-2 font-semibold text-sm">
                        {collapsedCategories[category] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {CATEGORY_LABELS[category] || category}
                        <span className="text-muted-foreground font-normal">({codes.length})</span>
                      </div>
                    </TableCell>
                  </TableRow>
                  {!collapsedCategories[category] && codes.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono font-semibold pl-10">{d.code}</TableCell>
                      <TableCell>{d.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.description || '—'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${d.is_active ? 'bg-green-500/10 text-green-500' : 'bg-secondary text-secondary-foreground'}`}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { setEditItem(d); setFormOpen(true) }}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => { setItemToDelete(d); setDeleteDialogOpen(true) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <DelayCodeFormDialog open={formOpen} onOpenChange={setFormOpen} delayCode={editItem} />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Delay Code</DialogTitle><DialogDescription>Are you sure you want to delete code {itemToDelete?.code} ({itemToDelete?.name})? This action cannot be undone.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
