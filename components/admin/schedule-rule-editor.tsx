'use client'

import { useState, useMemo, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MultiSelect } from '@/components/ui/multi-select'
import { Loader2, Trash2, X } from 'lucide-react'
import {
  createScheduleRule,
  updateScheduleRule,
  type ScheduleRule,
  type ScheduleRuleInput,
} from '@/app/actions/schedule-rules'
import { RuleSentence } from './schedule-preferences'
import { toast } from '@/components/ui/visionos-toast'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

type ScopeType = ScheduleRule['scope_type']
type ActionType = ScheduleRule['action']
type CriteriaType = ScheduleRule['criteria_type']

interface ScheduleRuleEditorProps {
  open: boolean
  onClose: () => void
  rule: ScheduleRule | null
  onSaved: () => void
  aircraftTypes: { id: string; icao_type: string; name: string; family?: string | null }[]
  registrations: { id: string; registration: string; aircraft_types: { icao_type: string; name?: string } | null }[]
  airports: { id: string; iata_code: string; name: string; country: string }[]
  serviceTypes: { id: string; code: string; name: string }[]
  countries: { id: string; iso_code_2: string; name: string; flag_emoji: string | null }[]
}

// ─── SectionLabel ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-muted-foreground font-bold uppercase block mb-2"
      style={{ fontSize: 9, letterSpacing: '0.05em' }}
    >
      {children}
    </span>
  )
}

// ─── RouteInput ──────────────────────────────────────────────────────

function RouteInput({ routes, onChange }: { routes: string[]; onChange: (r: string[]) => void }) {
  const [input, setInput] = useState('')

  const addRoute = () => {
    const val = input.trim().toUpperCase()
    if (!val) return
    if (!/^[A-Z]{3}-[A-Z]{3}$/.test(val)) {
      toast.error('Route must be in format: SGN-HAN')
      return
    }
    if (!routes.includes(val)) {
      onChange([...routes, val])
    }
    setInput('')
  }

  return (
    <div>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {routes.map(r => (
          <span key={r} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[11px] font-medium">
            {r}
            <button type="button" onClick={() => onChange(routes.filter(x => x !== r))} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRoute() } }}
          placeholder="SGN-HAN"
          className="flex-1 px-3 py-1.5 rounded-lg border text-[12px] bg-background outline-none focus:ring-2 focus:ring-primary/20 uppercase placeholder:normal-case placeholder:text-muted-foreground/50"
          maxLength={7}
        />
        <Button size="sm" variant="outline" onClick={addRoute} style={{ fontSize: 11 }}>
          Add
        </Button>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────

export function ScheduleRuleEditor({
  open,
  onClose,
  rule,
  onSaved,
  aircraftTypes,
  registrations,
  airports,
  serviceTypes,
  countries,
}: ScheduleRuleEditorProps) {
  const isEdit = !!rule

  // Form state
  const [name, setName] = useState(rule?.name || '')
  const [scopeType, setScopeType] = useState<ScopeType>(rule?.scope_type || 'type')
  const [scopeValues, setScopeValues] = useState<string[]>(rule?.scope_values || [])
  const [action, setAction] = useState<ActionType>(rule?.action || 'must_not_fly')
  const [criteriaType, setCriteriaType] = useState<CriteriaType>(rule?.criteria_type || 'airports')
  const [criteriaValues, setCriteriaValues] = useState<Record<string, any>>(rule?.criteria_values || {})
  const [validFrom, setValidFrom] = useState(rule?.valid_from || '')
  const [validTo, setValidTo] = useState(rule?.valid_to || '')
  const [noEndDate, setNoEndDate] = useState(!rule?.valid_to)
  const [notes, setNotes] = useState(rule?.notes || '')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Enforcement auto-derived from action
  const enforcement = ['must_fly', 'must_not_fly', 'can_only_fly'].includes(action) ? 'hard' : 'soft'

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(rule?.name || '')
      setScopeType(rule?.scope_type || 'type')
      setScopeValues(rule?.scope_values || [])
      setAction(rule?.action || 'must_not_fly')
      setCriteriaType(rule?.criteria_type || 'airports')
      setCriteriaValues(rule?.criteria_values || {})
      setValidFrom(rule?.valid_from || '')
      setValidTo(rule?.valid_to || '')
      setNoEndDate(!rule?.valid_to)
      setNotes(rule?.notes || '')
      setErrors({})
      setSaving(false)
    }
  }, [open, rule])

  // Unique families from aircraft types
  const uniqueFamilies = useMemo(() => {
    const families = new Set<string>()
    aircraftTypes.forEach(t => { if (t.family) families.add(t.family) })
    return Array.from(families).sort()
  }, [aircraftTypes])

  // Preview rule for RuleSentence
  const previewRule = useMemo(() => ({
    scope_type: scopeType,
    scope_values: scopeValues,
    action,
    criteria_type: criteriaType,
    criteria_values: criteriaValues,
    enforcement,
  }), [scopeType, scopeValues, action, criteriaType, criteriaValues, enforcement])

  // ─── Validation ─────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: Record<string, string> = {}

    if (scopeType !== 'all' && scopeValues.length === 0) {
      newErrors.scope = 'Select at least one aircraft'
    }

    switch (criteriaType) {
      case 'airports':
        if (!(criteriaValues.airports?.length > 0)) newErrors.criteria = 'Select at least one airport'
        break
      case 'routes':
        if (!(criteriaValues.routes?.length > 0)) newErrors.criteria = 'Add at least one route'
        break
      case 'service_type':
        if (!(criteriaValues.types?.length > 0)) newErrors.criteria = 'Select at least one service type'
        break
      case 'departure_time':
        if (!criteriaValues.from || !criteriaValues.to) newErrors.criteria = 'Both times required'
        break
      case 'block_time':
        if (!criteriaValues.minutes || criteriaValues.minutes <= 0) newErrors.criteria = 'Enter a valid block time'
        break
      case 'day_of_week':
        if (!(criteriaValues.days?.length > 0)) newErrors.criteria = 'Select at least one day'
        break
      case 'country':
        if (!(criteriaValues.countries?.length > 0)) newErrors.criteria = 'Select at least one country'
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ─── Save ───────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)

    try {
      const input: ScheduleRuleInput = {
        name: name || null,
        scope_type: scopeType,
        scope_values: scopeType === 'all' ? [] : scopeValues,
        action,
        criteria_type: criteriaType,
        criteria_values: criteriaValues,
        enforcement: enforcement as 'hard' | 'soft',
        valid_from: validFrom || null,
        valid_to: noEndDate ? null : validTo || null,
        is_active: rule?.is_active ?? true,
        priority: rule?.priority ?? 100,
        notes: notes || null,
      }

      if (isEdit) {
        const { error } = await updateScheduleRule(rule!.id, input)
        if (error) { toast.error(error); return }
        toast.success('Rule updated')
      } else {
        const { error } = await createScheduleRule(input)
        if (error) { toast.error(error); return }
        toast.success('Rule created')
      }

      onSaved()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-[560px] max-h-[85vh] flex flex-col p-0 gap-0">

        {/* Header */}
        <div style={{ padding: '20px 24px 12px 24px' }}>
          <DialogHeader className="p-0 space-y-0">
            <DialogTitle style={{ fontSize: 15 }} className="font-bold">
              {isEdit ? 'Edit Rule' : 'New Rule'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground" style={{ fontSize: 12, marginTop: 4 }}>
            Define aircraft assignment constraints
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 py-2" style={{ padding: '0 24px 16px 24px' }}>

          {/* ── SECTION 1: AIRCRAFT SCOPE ── */}
          <div>
            <SectionLabel>Aircraft Scope</SectionLabel>

            <div className="flex gap-1 p-1 rounded-lg bg-muted/40 w-fit">
              {(['all', 'type', 'family', 'registration'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setScopeType(t); setScopeValues([]) }}
                  className={cn(
                    'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                    scopeType === t
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'all' ? 'All' : t === 'type' ? 'Type' : t === 'family' ? 'Family' : 'Registration'}
                </button>
              ))}
            </div>

            <div className="mt-2">
              {scopeType === 'all' && (
                <p className="text-muted-foreground" style={{ fontSize: 11 }}>
                  Applies to all aircraft in the fleet
                </p>
              )}

              {scopeType === 'type' && (
                <MultiSelect
                  options={aircraftTypes.map(t => ({ value: t.icao_type, label: `${t.icao_type} \u2014 ${t.name}` }))}
                  selected={scopeValues}
                  onChange={setScopeValues}
                  placeholder="Select aircraft types..."
                />
              )}

              {scopeType === 'family' && (
                <MultiSelect
                  options={uniqueFamilies.map(f => ({ value: f, label: `${f} family` }))}
                  selected={scopeValues}
                  onChange={setScopeValues}
                  placeholder="Select aircraft family..."
                />
              )}

              {scopeType === 'registration' && (
                <MultiSelect
                  options={registrations.map(r => ({
                    value: r.registration,
                    label: `${r.registration} (${r.aircraft_types?.icao_type || '?'})`,
                  }))}
                  selected={scopeValues}
                  onChange={setScopeValues}
                  placeholder="Select aircraft..."
                />
              )}

              {errors.scope && (
                <p className="text-destructive mt-1" style={{ fontSize: 10 }}>{errors.scope}</p>
              )}
            </div>
          </div>

          {/* ── SECTION 2: ACTION ── */}
          <div>
            <SectionLabel>Action</SectionLabel>

            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'must_fly' as const, label: 'Must fly', sub: 'Hard rule' },
                { value: 'should_fly' as const, label: 'Should fly', sub: 'Soft rule' },
                { value: 'must_not_fly' as const, label: 'Must not fly', sub: 'Hard rule' },
                { value: 'should_avoid' as const, label: 'Should avoid', sub: 'Soft rule' },
              ]).map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAction(opt.value)}
                  className={cn(
                    'text-left p-2.5 rounded-lg border transition-colors',
                    action === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  <div style={{ fontSize: 12 }} className="font-medium">{opt.label}</div>
                  <div style={{ fontSize: 10 }} className="text-muted-foreground">{opt.sub}</div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setAction('can_only_fly')}
                className={cn(
                  'col-span-2 text-left p-2.5 rounded-lg border transition-colors',
                  action === 'can_only_fly'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/30'
                )}
              >
                <div style={{ fontSize: 12 }} className="font-medium">Can only fly (exclusive)</div>
                <div style={{ fontSize: 10 }} className="text-muted-foreground">Hard rule</div>
              </button>
            </div>
          </div>

          {/* ── SECTION 3: FLIGHT CRITERIA ── */}
          <div>
            <SectionLabel>Flight Criteria</SectionLabel>

            <select
              value={criteriaType}
              onChange={e => { setCriteriaType(e.target.value as CriteriaType); setCriteriaValues({}) }}
              className="w-full px-3 py-1.5 rounded-lg border text-[12px] bg-background outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="airports">Airports</option>
              <option value="routes">Routes</option>
              <option value="international">International flights</option>
              <option value="domestic">Domestic flights</option>
              <option value="service_type">Service type</option>
              <option value="departure_time">Departure time window</option>
              <option value="block_time">Block time condition</option>
              <option value="overnight">Overnight flights</option>
              <option value="day_of_week">Day of week</option>
              <option value="country">Country</option>
            </select>

            <div className="mt-2">

              {criteriaType === 'airports' && (
                <div className="space-y-2">
                  <div className="flex gap-1 p-1 rounded-lg bg-muted/40 w-fit">
                    {(['any', 'to', 'from'] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCriteriaValues(prev => ({ ...prev, direction: d }))}
                        className={cn(
                          'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                          (criteriaValues.direction || 'any') === d
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {d === 'any' ? 'Any' : d === 'to' ? 'To' : 'From'}
                      </button>
                    ))}
                  </div>
                  <MultiSelect
                    options={airports.map(a => ({ value: a.iata_code, label: `${a.iata_code} \u2014 ${a.name}` }))}
                    selected={criteriaValues.airports || []}
                    onChange={v => setCriteriaValues(prev => ({ ...prev, airports: v }))}
                    placeholder="Select airports..."
                    searchable
                  />
                </div>
              )}

              {criteriaType === 'routes' && (
                <div className="space-y-2">
                  <p className="text-muted-foreground" style={{ fontSize: 10 }}>
                    Enter routes as ORIGIN-DESTINATION (e.g. SGN-HAN)
                  </p>
                  <RouteInput
                    routes={criteriaValues.routes || []}
                    onChange={routes => setCriteriaValues({ routes })}
                  />
                </div>
              )}

              {(criteriaType === 'international' || criteriaType === 'domestic' || criteriaType === 'overnight') && (
                <p className="text-muted-foreground" style={{ fontSize: 11 }}>
                  Matches all {criteriaType} flights &mdash; no additional configuration needed.
                </p>
              )}

              {criteriaType === 'service_type' && (
                <MultiSelect
                  options={serviceTypes.map(s => ({ value: s.code, label: `${s.code} \u2014 ${s.name}` }))}
                  selected={criteriaValues.types || []}
                  onChange={v => setCriteriaValues({ types: v })}
                  placeholder="Select service types..."
                />
              )}

              {criteriaType === 'departure_time' && (
                <div className="flex items-center gap-2">
                  <label className="text-muted-foreground" style={{ fontSize: 11 }}>From</label>
                  <input
                    type="time"
                    value={criteriaValues.from || '00:00'}
                    onChange={e => setCriteriaValues(prev => ({ ...prev, from: e.target.value }))}
                    className="px-2 py-1 rounded-lg border text-[12px] bg-background w-[100px]"
                  />
                  <label className="text-muted-foreground" style={{ fontSize: 11 }}>To</label>
                  <input
                    type="time"
                    value={criteriaValues.to || '05:00'}
                    onChange={e => setCriteriaValues(prev => ({ ...prev, to: e.target.value }))}
                    className="px-2 py-1 rounded-lg border text-[12px] bg-background w-[100px]"
                  />
                </div>
              )}

              {criteriaType === 'block_time' && (
                <div className="flex items-center gap-2">
                  <select
                    value={criteriaValues.operator || 'gt'}
                    onChange={e => setCriteriaValues(prev => ({ ...prev, operator: e.target.value }))}
                    className="px-2 py-1 rounded-lg border text-[12px] bg-background"
                  >
                    <option value="gt">Greater than</option>
                    <option value="lt">Less than</option>
                    <option value="gte">Greater or equal</option>
                    <option value="lte">Less or equal</option>
                    <option value="eq">Equal to</option>
                  </select>
                  <input
                    type="number"
                    value={criteriaValues.minutes ?? 240}
                    onChange={e => setCriteriaValues(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                    className="px-2 py-1 rounded-lg border text-[12px] bg-background w-[80px]"
                    min={0}
                    step={15}
                  />
                  <span className="text-muted-foreground" style={{ fontSize: 11 }}>
                    min ({Math.floor((criteriaValues.minutes || 240) / 60)}h{(criteriaValues.minutes || 240) % 60 > 0 ? ` ${(criteriaValues.minutes || 240) % 60}m` : ''})
                  </span>
                </div>
              )}

              {criteriaType === 'day_of_week' && (
                <div className="flex gap-1">
                  {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']).map((day, i) => {
                    const dayNum = i + 1
                    const selected = (criteriaValues.days || []).includes(dayNum)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const days = criteriaValues.days || []
                          setCriteriaValues({
                            days: selected
                              ? days.filter((d: number) => d !== dayNum)
                              : [...days, dayNum].sort()
                          })
                        }}
                        className={cn(
                          'w-9 h-8 rounded-md text-[11px] font-medium transition-colors',
                          selected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                        )}
                      >
                        {day}
                      </button>
                    )
                  })}
                </div>
              )}

              {criteriaType === 'country' && (
                <div className="space-y-2">
                  <div className="flex gap-1 p-1 rounded-lg bg-muted/40 w-fit">
                    {(['any', 'to', 'from'] as const).map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setCriteriaValues(prev => ({ ...prev, direction: d }))}
                        className={cn(
                          'px-3 py-1 rounded-md text-[11px] font-medium transition-colors',
                          (criteriaValues.direction || 'any') === d
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        {d === 'any' ? 'Any' : d === 'to' ? 'To' : 'From'}
                      </button>
                    ))}
                  </div>
                  <MultiSelect
                    options={countries.map(c => ({ value: c.iso_code_2, label: `${c.flag_emoji || ''} ${c.name}`.trim() }))}
                    selected={criteriaValues.countries || []}
                    onChange={v => setCriteriaValues(prev => ({ ...prev, countries: v }))}
                    placeholder="Select countries..."
                    searchable
                  />
                </div>
              )}

              {errors.criteria && (
                <p className="text-destructive mt-1" style={{ fontSize: 10 }}>{errors.criteria}</p>
              )}
            </div>
          </div>

          {/* ── SECTION 4: VALIDITY & NOTES ── */}
          <div>
            <SectionLabel>Validity &amp; Notes</SectionLabel>

            <div className="flex items-center gap-3">
              <div>
                <label className="text-muted-foreground block mb-1" style={{ fontSize: 10 }}>From</label>
                <input
                  type="date"
                  value={validFrom}
                  onChange={e => setValidFrom(e.target.value)}
                  className="px-2 py-1 rounded-lg border text-[12px] bg-background"
                />
              </div>
              <div>
                <label className="text-muted-foreground block mb-1" style={{ fontSize: 10 }}>To</label>
                <input
                  type="date"
                  value={noEndDate ? '' : validTo}
                  onChange={e => { setValidTo(e.target.value); setNoEndDate(false) }}
                  disabled={noEndDate}
                  className="px-2 py-1 rounded-lg border text-[12px] bg-background disabled:opacity-50"
                />
              </div>
              <label className="flex items-center gap-1.5 mt-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={noEndDate}
                  onChange={e => { setNoEndDate(e.target.checked); if (e.target.checked) setValidTo('') }}
                  className="rounded"
                />
                <span style={{ fontSize: 11 }}>No end date</span>
              </label>
            </div>
            {!validFrom && !validTo && (
              <p className="text-muted-foreground mt-1" style={{ fontSize: 10 }}>
                Valid indefinitely
              </p>
            )}

            <div className="mt-3">
              <label className="text-muted-foreground block mb-1" style={{ fontSize: 10 }}>Rule name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Bilateral agreement TXL"
                className="w-full px-3 py-1.5 rounded-lg border text-[12px] bg-background outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="mt-3">
              <label className="text-muted-foreground block mb-1" style={{ fontSize: 10 }}>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes about this rule..."
                className="w-full px-3 py-1.5 rounded-lg border text-[11px] bg-background outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* ── PREVIEW ── */}
          <div>
            <div className="border-t border-dashed my-1" />
            <SectionLabel>Preview</SectionLabel>
            <div className="rounded-lg bg-muted/30 p-3">
              <div style={{ fontSize: 12 }}>
                <RuleSentence rule={previewRule} />
              </div>
              <p className="text-muted-foreground mt-1" style={{ fontSize: 10 }}>
                {enforcement === 'hard' ? '\u26A1 Hard rule' : '\u25CB Soft rule'}
                {validFrom || validTo
                  ? ` \u00B7 Valid ${validFrom || '...'} \u2013 ${noEndDate ? 'No end date' : validTo || '...'}`
                  : ' \u00B7 Valid indefinitely'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t" style={{ padding: '14px 24px' }}>
          <div>
            {isEdit && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                size="sm"
                onClick={onClose}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {saving ? 'Saving...' : isEdit ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
