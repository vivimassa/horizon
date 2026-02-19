'use client'

import { useState, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  SlidersHorizontal,
  Search,
} from 'lucide-react'
import {
  getScheduleRules,
  toggleScheduleRule,
  deleteScheduleRule,
  reorderScheduleRules,
  type ScheduleRule,
} from '@/app/actions/schedule-rules'
import { ScheduleRuleEditor } from './schedule-rule-editor'
import { toast } from '@/components/ui/visionos-toast'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

interface SchedulePreferencesProps {
  initialRules: ScheduleRule[]
  aircraftTypes: { id: string; icao_type: string; name: string; is_active: boolean }[]
  registrations: { id: string; registration: string; aircraft_types: { icao_type: string } | null }[]
  airports: { id: string; iata_code: string; name: string; country: string }[]
  serviceTypes: { id: string; code: string; name: string }[]
  countries: { id: string; iso_code_2: string; name: string; flag_emoji: string | null }[]
}

// ─── Constants ────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  must_fly: 'must fly',
  should_fly: 'should fly',
  must_not_fly: 'must not fly',
  should_avoid: 'should avoid',
  can_only_fly: 'can only fly',
}

const DAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── RuleSentence (shared with schedule-rule-editor) ─────────────────

export function RuleSentence({ rule }: { rule: any }) {
  let who: string
  if (rule.scope_type === 'all') who = 'All aircraft'
  else if (rule.scope_type === 'family') who = (rule.scope_values || []).join(', ') + ' family'
  else who = (rule.scope_values || []).join(', ') || '...'

  const actionText = ACTION_LABELS[rule.action] || rule.action
  const isRestrictive = (rule.action || '').includes('not') || (rule.action || '').includes('avoid')

  let criteria: string
  const cv = rule.criteria_values || {}
  switch (rule.criteria_type) {
    case 'airports': {
      const dir = cv.direction === 'to' ? 'to' : cv.direction === 'from' ? 'from' : 'via'
      criteria = `${dir} ${(cv.airports || []).join(', ') || '...'}`
      break
    }
    case 'routes':
      criteria = `on routes ${(cv.routes || []).join(', ') || '...'}`
      break
    case 'international':
      criteria = 'international flights'
      break
    case 'domestic':
      criteria = 'domestic flights'
      break
    case 'service_type':
      criteria = `${(cv.types || []).join(', ') || '...'} service flights`
      break
    case 'departure_time':
      criteria = `flights departing ${cv.from || '?'} \u2013 ${cv.to || '?'}`
      break
    case 'block_time': {
      const opMap: Record<string, string> = { gt: '>', lt: '<', gte: '\u2265', lte: '\u2264', eq: '=' }
      const op = opMap[cv.operator] || '>'
      const mins = cv.minutes || 0
      const h = Math.floor(mins / 60)
      const m = mins % 60
      criteria = `flights with block time ${op} ${h}h${m > 0 ? ` ${m}m` : ''}`
      break
    }
    case 'overnight':
      criteria = 'overnight flights'
      break
    case 'day_of_week':
      criteria = `on ${(cv.days || []).map((d: number) => DAY_NAMES[d]).join(', ') || '...'}`
      break
    case 'country': {
      const dir = cv.direction === 'to' ? 'to' : cv.direction === 'from' ? 'from' : 'via'
      criteria = `${dir} ${(cv.countries || []).join(', ') || '...'}`
      break
    }
    default:
      criteria = '...'
  }

  return (
    <span>
      <span className="font-semibold">{who}</span>
      <span className="text-muted-foreground mx-1.5">&rarr;</span>
      <span
        className="font-medium"
        style={{ color: isRestrictive ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}
      >
        {actionText}
      </span>
      <span className="text-muted-foreground mx-1.5">&rarr;</span>
      <span>{criteria}</span>
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────

export function SchedulePreferences({
  initialRules,
  aircraftTypes,
  registrations,
  airports,
  serviceTypes,
  countries,
}: SchedulePreferencesProps) {
  const [rules, setRules] = useState(initialRules)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ScheduleRule | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  // Sync when page re-renders after editor save / router.refresh()
  useMemo(() => setRules(initialRules), [initialRules])

  // ─── Refresh rules from server ──────────────────────────────────────

  const refreshRules = useCallback(async () => {
    const fresh = await getScheduleRules()
    setRules(fresh)
  }, [])

  // ─── Filtering ──────────────────────────────────────────────────────

  const filteredRules = useMemo(() => {
    let result = [...rules]

    if (statusFilter === 'active') result = result.filter(r => r.is_active)
    if (statusFilter === 'inactive') result = result.filter(r => !r.is_active)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        r.scope_values.some(v => v.toLowerCase().includes(q)) ||
        JSON.stringify(r.criteria_values).toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      )
    }

    return result
  }, [rules, statusFilter, searchQuery])

  // ─── Rule number map (stable across filters) ──────────────────────

  const ruleNumberMap = useMemo(() => {
    const map = new Map<string, number>()
    rules.forEach((r, i) => map.set(r.id, i + 1))
    return map
  }, [rules])

  // ─── Toggle active ──────────────────────────────────────────────────

  const handleToggle = useCallback(async (id: string, checked: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: checked } : r))
    const { error } = await toggleScheduleRule(id, checked)
    if (error) {
      toast.error(error)
      setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: !checked } : r))
    }
  }, [])

  // ─── Delete ─────────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeleting(true)
    const { error } = await deleteScheduleRule(id)
    if (error) {
      toast.error('Failed to delete rule', { description: error })
    } else {
      toast.success('Rule deleted')
      await refreshRules()
    }
    setDeleting(false)
    setDeleteConfirmId(null)
  }, [deleteConfirmId, refreshRules])

  // ─── Drag & drop reorder ───────────────────────────────────────────

  const handleDragStart = (id: string) => setDragging(id)
  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    setDragOver(id)
  }
  const handleDrop = useCallback(async (targetId: string) => {
    if (!dragging || dragging === targetId) {
      setDragging(null)
      setDragOver(null)
      return
    }
    const newRules = [...rules]
    const fromIdx = newRules.findIndex(r => r.id === dragging)
    const toIdx = newRules.findIndex(r => r.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const [moved] = newRules.splice(fromIdx, 1)
    newRules.splice(toIdx, 0, moved)
    setRules(newRules)
    setDragging(null)
    setDragOver(null)

    const { error } = await reorderScheduleRules(newRules.map(r => r.id))
    if (error) {
      toast.error('Failed to reorder rules')
      setRules(initialRules)
    }
  }, [dragging, rules, initialRules])

  // ─── EmptyState ────────────────────────────────────────────────────

  function EmptyState() {
    return (
      <div className="flex flex-col items-start mt-8">
        <div
          className="rounded-full bg-muted/30 flex items-center justify-center mb-3"
          style={{ width: 52, height: 52 }}
        >
          <SlidersHorizontal className="text-muted-foreground" style={{ width: 24, height: 24 }} />
        </div>
        <p className="font-medium" style={{ fontSize: 13 }}>
          No rules configured
        </p>
        <p className="text-muted-foreground mt-1 max-w-sm" style={{ fontSize: 11 }}>
          Rules control how the optimizer assigns aircraft to flights.
          Create your first rule to get started.
        </p>
        <Button
          className="mt-3"
          size="sm"
          onClick={() => { setEditingRule(null); setEditorOpen(true) }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create First Rule
        </Button>
      </div>
    )
  }

  // ─── RuleCard ──────────────────────────────────────────────────────

  function RuleCard({ rule, ruleNumber }: { rule: ScheduleRule; ruleNumber: number }) {
    return (
      <div
        draggable
        onDragStart={() => handleDragStart(rule.id)}
        onDragOver={(e) => handleDragOver(e, rule.id)}
        onDrop={() => handleDrop(rule.id)}
        onDragEnd={() => { setDragging(null); setDragOver(null) }}
        className={cn(
          'border-[2px] border-border/80 rounded-[10px] p-3.5 transition-colors group',
          !rule.is_active && 'opacity-50',
          dragOver === rule.id && 'border-primary bg-primary/[0.03]',
          dragging === rule.id && 'opacity-40'
        )}
      >
        <div className="flex gap-3">
          {/* Left: content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: badge + name */}
            <div className="flex items-center gap-2 mb-2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab shrink-0" />
              <span
                className="w-[52px] text-center py-0.5 rounded-full text-white font-semibold"
                style={{
                  fontSize: 9,
                  background: rule.enforcement === 'hard'
                    ? '#DC2626'
                    : '#F59E0B',
                }}
              >
                {rule.enforcement === 'hard' ? 'Hard' : 'Soft'}
              </span>
              <span className="font-semibold" style={{ fontSize: 12 }}>
                <span className="text-muted-foreground font-medium">Rule {ruleNumber}:</span>{' '}
                {rule.name || 'Untitled'}
              </span>
            </div>

            {/* Row 2: sentence */}
            <div className={cn('ml-6', !rule.is_active && 'line-through')} style={{ fontSize: 14 }}>
              <RuleSentence rule={rule} />
            </div>

            {/* Row 3: metadata */}
            <div className="flex items-center gap-3 ml-6 mt-2" style={{ fontSize: 11 }}>
              <span className="text-muted-foreground">
                {rule.valid_from || rule.valid_to
                  ? `Valid: ${rule.valid_from ? formatDate(rule.valid_from) : '...'} \u2013 ${rule.valid_to ? formatDate(rule.valid_to) : 'No end date'}`
                  : 'Valid: Always'}
              </span>
              {rule.notes && (
                <span className="text-muted-foreground truncate max-w-[200px]">
                  {rule.notes}
                </span>
              )}
            </div>
          </div>

          {/* Right: status + actions stacked vertically */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => handleToggle(rule.id, !rule.is_active)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                rule.is_active
                  ? 'border-emerald-300/50 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-700/50'
                  : 'border-border bg-muted/30'
              )}
            >
              <span className="relative flex h-2 w-2">
                {rule.is_active && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span className={cn(
                  'relative inline-flex rounded-full h-2 w-2',
                  rule.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                )} />
              </span>
              <span style={{ fontSize: 10 }} className={cn(
                'font-medium',
                rule.is_active ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'
              )}>
                {rule.is_active ? 'Active' : 'Inactive'}
              </span>
            </button>
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { setEditingRule(rule); setEditorOpen(true) }}
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => setDeleteConfirmId(rule.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 overflow-y-auto h-full p-4">

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">
          Schedule Preferences &amp; Restrictions
        </h1>
        <p className="text-muted-foreground mt-1" style={{ fontSize: 12 }}>
          Define rules that control how aircraft are assigned to flights
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <Button onClick={() => { setEditingRule(null); setEditorOpen(true) }} className="text-[13px] px-5 py-2 h-auto">
          New Rule
        </Button>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 rounded-xl border text-[13px] bg-background outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-xl border text-[13px] w-[260px] outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
            />
          </div>
        </div>
      </div>

      {/* Summary bar */}
      <p className="text-muted-foreground" style={{ fontSize: 10 }}>
        {rules.length} rule{rules.length !== 1 ? 's' : ''} &middot;{' '}
        {rules.filter(r => r.enforcement === 'hard').length} hard,{' '}
        {rules.filter(r => r.enforcement === 'soft').length} soft &middot;{' '}
        {rules.filter(r => r.is_active).length} active
      </p>

      {/* Rule list OR empty state */}
      {filteredRules.length === 0 && rules.length === 0 ? (
        <EmptyState />
      ) : filteredRules.length === 0 ? (
        <p className="text-muted-foreground py-8" style={{ fontSize: 11 }}>
          No rules match the current filter.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {/* Hard rules — left column */}
          <div className="space-y-2">
            <p className="text-[15px] font-bold tracking-tight">
              Hard Rules
            </p>
            {filteredRules.filter(r => r.enforcement === 'hard').map(rule => (
              <RuleCard key={rule.id} rule={rule} ruleNumber={ruleNumberMap.get(rule.id) || 0} />
            ))}
            {filteredRules.filter(r => r.enforcement === 'hard').length === 0 && (
              <p className="text-muted-foreground py-4" style={{ fontSize: 11 }}>
                No hard rules.
              </p>
            )}
          </div>

          {/* 8px divider between columns is handled by gap-2 (8px) */}

          {/* Soft rules — right column */}
          <div className="space-y-2">
            <p className="text-[15px] font-bold tracking-tight">
              Soft Rules
            </p>
            {filteredRules.filter(r => r.enforcement === 'soft').map(rule => (
              <RuleCard key={rule.id} rule={rule} ruleNumber={ruleNumberMap.get(rule.id) || 0} />
            ))}
            {filteredRules.filter(r => r.enforcement === 'soft').length === 0 && (
              <p className="text-muted-foreground py-4" style={{ fontSize: 11 }}>
                No soft rules.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Editor dialog */}
      {editorOpen && (
        <ScheduleRuleEditor
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingRule(null) }}
          rule={editingRule}
          onSaved={refreshRules}
          aircraftTypes={aircraftTypes}
          registrations={registrations}
          airports={airports}
          serviceTypes={serviceTypes}
          countries={countries}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
