'use client'

import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  sortable?: boolean
  hideOnMobile?: boolean
  mobileLabel?: string
  className?: string
}

interface ResponsiveDataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  keyExtractor: (item: T) => string
  onSort?: (key: string) => void
  sortColumn?: string | null
  sortDirection?: 'asc' | 'desc'
  renderActions?: (item: T) => React.ReactNode
  searchBar?: React.ReactNode
  toolbar?: React.ReactNode
  emptyMessage?: string
  className?: string
}

export function ResponsiveDataTable<T>({
  data,
  columns,
  keyExtractor,
  onSort,
  sortColumn,
  sortDirection,
  renderActions,
  searchBar,
  toolbar,
  emptyMessage = 'No data found.',
  className,
}: ResponsiveDataTableProps<T>) {
  const breakpoint = useBreakpoint()

  function getSortIcon(columnKey: string) {
    if (sortColumn !== columnKey) return <ArrowUpDown className="ml-2 h-4 w-4" />
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header area */}
      {(searchBar || toolbar) && (
        <div className={cn(
          'flex gap-4',
          breakpoint === 'mobile' ? 'flex-col' : 'items-center justify-between'
        )}>
          {searchBar}
          {toolbar}
        </div>
      )}

      {/* Desktop/Tablet: Table view */}
      {breakpoint !== 'mobile' ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.sortable && onSort ? (
                      <Button
                        variant="ghost"
                        onClick={() => onSort(col.key)}
                        className="font-semibold"
                      >
                        {col.header}
                        {getSortIcon(col.key)}
                      </Button>
                    ) : (
                      <span className="font-semibold">{col.header}</span>
                    )}
                  </TableHead>
                ))}
                {renderActions && (
                  <TableHead className="text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (renderActions ? 1 : 0)}
                    className="text-center text-muted-foreground py-8"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={keyExtractor(item)}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.render(item)}
                      </TableCell>
                    ))}
                    {renderActions && (
                      <TableCell className="text-right">
                        {renderActions(item)}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* Mobile: Card view */
        <div className="space-y-3">
          {data.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            data.map((item) => (
              <div key={keyExtractor(item)} className="glass rounded-2xl p-4 space-y-2">
                {columns
                  .filter((col) => !col.hideOnMobile)
                  .map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-2">
                      <span className="text-xs font-medium text-muted-foreground shrink-0">
                        {col.mobileLabel || col.header}
                      </span>
                      <span className={cn('text-sm text-right', col.className)}>
                        {col.render(item)}
                      </span>
                    </div>
                  ))}
                {renderActions && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                    {renderActions(item)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
