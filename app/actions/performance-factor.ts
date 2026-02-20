'use server'

import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const REVALIDATE_PATH = '/admin/master-database/aircraft-registrations/performance-factor'

// ─── Types ───────────────────────────────────────────────────────────────

export interface PFRecord {
  id: string
  aircraft_id: string
  period_name: string
  effective_from: string
  effective_to: string | null
  performance_factor: number
  variant: string | null
  notes: string | null
  registration: string
  icao_type: string
}

export interface PFPeriod {
  period_name: string
  effective_from: string
  effective_to: string | null
  count: number
}

// ─── Fetch ───────────────────────────────────────────────────────────────

export async function getPerformanceFactors(): Promise<PFRecord[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('aircraft_performance_factors')
    .select(`
      id, aircraft_id, period_name, effective_from, effective_to,
      performance_factor, variant, notes,
      aircraft!inner ( registration, aircraft_type_id,
        aircraft_types!aircraft_type_id ( icao_type )
      )
    `)
    .order('effective_from', { ascending: false })

  if (error) {
    console.error('Error fetching PF records:', error)
    return []
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    aircraft_id: r.aircraft_id,
    period_name: r.period_name,
    effective_from: r.effective_from,
    effective_to: r.effective_to,
    performance_factor: Number(r.performance_factor),
    variant: r.variant,
    notes: r.notes,
    registration: r.aircraft?.registration ?? '',
    icao_type: r.aircraft?.aircraft_types?.icao_type ?? '',
  }))
}

export async function getPerformanceFactorPeriods(): Promise<PFPeriod[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('aircraft_performance_factors')
    .select('period_name, effective_from, effective_to')
    .order('effective_from', { ascending: false })

  if (error) {
    console.error('Error fetching PF periods:', error)
    return []
  }

  // Group by period_name
  const periodMap = new Map<string, { effective_from: string; effective_to: string | null; count: number }>()
  for (const r of data || []) {
    const existing = periodMap.get(r.period_name)
    if (existing) {
      existing.count++
    } else {
      periodMap.set(r.period_name, {
        effective_from: r.effective_from,
        effective_to: r.effective_to,
        count: 1,
      })
    }
  }

  return Array.from(periodMap.entries()).map(([name, info]) => ({
    period_name: name,
    effective_from: info.effective_from,
    effective_to: info.effective_to,
    count: info.count,
  }))
}

// ─── Create Period ──────────────────────────────────────────────────────

export async function createPerformanceFactorPeriod(payload: {
  periodName: string
  effectiveFrom: string
  effectiveTo: string | null
  entries: { aircraftId: string; performanceFactor: number; variant?: string | null }[]
}) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const rows = payload.entries.map(e => ({
    operator_id: operatorId,
    aircraft_id: e.aircraftId,
    period_name: payload.periodName,
    effective_from: payload.effectiveFrom,
    effective_to: payload.effectiveTo,
    performance_factor: e.performanceFactor,
    variant: e.variant ?? null,
  }))

  const { error: insertError } = await supabase
    .from('aircraft_performance_factors')
    .insert(rows)

  if (insertError) return { error: insertError.message }

  // Update aircraft.performance_factor and variant for each aircraft
  for (const e of payload.entries) {
    await supabase
      .from('aircraft')
      .update({
        performance_factor: e.performanceFactor,
        variant: e.variant ?? undefined,
      })
      .eq('id', e.aircraftId)
  }

  revalidatePath(REVALIDATE_PATH)
  revalidatePath('/admin/master-database/aircraft-registrations')
  return { success: true, count: rows.length }
}

// ─── Update Single Entry ─────────────────────────────────────────────────

export async function updatePerformanceFactor(
  id: string,
  performanceFactor: number
) {
  const supabase = createAdminClient()

  // Get the record to find aircraft_id and check if it's current period
  const { data: record } = await supabase
    .from('aircraft_performance_factors')
    .select('aircraft_id, effective_from')
    .eq('id', id)
    .single()

  if (!record) return { error: 'Record not found' }

  const { error } = await supabase
    .from('aircraft_performance_factors')
    .update({ performance_factor: performanceFactor, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  // Check if this is the latest period for this aircraft
  const { data: latest } = await supabase
    .from('aircraft_performance_factors')
    .select('id')
    .eq('aircraft_id', record.aircraft_id)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single()

  if (latest?.id === id) {
    // This is the current period — update aircraft table
    await supabase
      .from('aircraft')
      .update({ performance_factor: performanceFactor })
      .eq('id', record.aircraft_id)
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Bulk Update ─────────────────────────────────────────────────────────

export async function bulkUpdatePerformanceFactors(
  entries: { id: string; performanceFactor: number }[]
) {
  const supabase = createAdminClient()

  for (const e of entries) {
    await supabase
      .from('aircraft_performance_factors')
      .update({ performance_factor: e.performanceFactor, updated_at: new Date().toISOString() })
      .eq('id', e.id)
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

// ─── Delete Period ──────────────────────────────────────────────────────

export async function deletePerformanceFactorPeriod(periodName: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('aircraft_performance_factors')
    .delete()
    .eq('period_name', periodName)

  if (error) return { error: error.message }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
