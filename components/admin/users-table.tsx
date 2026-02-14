'use client'

import { useState, useMemo } from 'react'
import { Operator } from '@/types/database'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserEditDialog } from './user-edit-dialog'
import { deleteUser } from '@/app/actions/users'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type SortColumn = 'email' | 'full_name' | 'role' | 'status' | 'created_at'
type SortDirection = 'asc' | 'desc'

const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  ops_controller: 'Ops Controller',
  crew_controller: 'Crew Controller',
  roster_planner: 'Roster Planner',
  crew_member: 'Crew Member',
  viewer: 'Viewer',
}

const roleColors: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  admin: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  ops_controller: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  crew_controller: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  roster_planner: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  crew_member: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  viewer: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}

export function UsersTable({ users }: { users: Operator[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [editUser, setEditUser] = useState<Operator | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<Operator | null>(null)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const filteredAndSortedUsers = useMemo(() => {
    let filtered = users
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(u =>
        u.email.toLowerCase().includes(query) ||
        u.full_name?.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
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
  }, [users, searchQuery, sortColumn, sortDirection])

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
    if (!userToDelete) return
    setDeleting(true)
    const result = await deleteUser(userToDelete.id)
    if (result?.error) alert(`Error: ${result.error}`)
    else router.refresh()
    setDeleting(false)
    setDeleteDialogOpen(false)
    setUserToDelete(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {filteredAndSortedUsers.length} of {users.length} users
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Button variant="ghost" onClick={() => handleSort('email')} className="font-semibold">Email{getSortIcon('email')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('full_name')} className="font-semibold">Name{getSortIcon('full_name')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('role')} className="font-semibold">Role{getSortIcon('role')}</Button></TableHead>
              <TableHead><Button variant="ghost" onClick={() => handleSort('status')} className="font-semibold">Status{getSortIcon('status')}</Button></TableHead>
              <TableHead>Modules</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {searchQuery ? 'No users found.' : 'No users in database.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.full_name || '—'}</TableCell>
                  <TableCell>
                    <Badge className={roleColors[user.role]}>
                      {roleLabels[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[user.status]}>
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.enabled_modules.slice(0, 3).map(module => (
                        <Badge key={module} variant="outline" className="text-xs">
                          {module}
                        </Badge>
                      ))}
                      {user.enabled_modules.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.enabled_modules.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditUser(user); setEditDialogOpen(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setUserToDelete(user); setDeleteDialogOpen(true); }}>
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

      <UserEditDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} user={editUser} />
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>Are you sure you want to delete {userToDelete?.email}? This action cannot be undone.</DialogDescription>
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
