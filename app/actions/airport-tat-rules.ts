'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface TatRuleWithType {
  id: string
  airport_id: string
  aircraft_type_id: string
  tat_minutes: number
  tat_dom_dom_minutes: number | null
  tat_dom_int_minutes: number | null
  tat_int_dom_minutes: number | null
  tat_int_int_minutes: number | null
  notes: string | null
  is_active: boolean
  created_at: string
  aircraft_types: { icao_type: string; name: string; default_tat_minutes: number | null } | null
}

export async function getAllTatRules() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_tat_rules')
    .select('*')
    .eq('is_active', true)
  if (error) { console.error('Error fetching TAT rules:', error); return [] }
  return data || []
}

export async function getTatRulesForAirport(airportId: string): Promise<TatRuleWithType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_tat_rules')
    .select('*, aircraft_types(icao_type, name, default_tat_minutes)')
    .eq('airport_id', airportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching TAT rules:', error)
    return []
  }
  return (data as unknown as TatRuleWithType[]) || []
}

export async function createTatRule(data: {
  airport_id: string
  aircraft_type_id: string
  tat_minutes: number
  tat_dom_dom_minutes?: number | null
  tat_dom_int_minutes?: number | null
  tat_int_dom_minutes?: number | null
  tat_int_int_minutes?: number | null
  notes?: string | null
}) {
  if (!data.airport_id || !data.aircraft_type_id || !data.tat_minutes) {
    return { error: 'Airport, aircraft type, and TAT minutes are required' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_tat_rules').insert(data)
  if (error) {
    if (error.code === '23505') return { error: 'A TAT rule for this airport and aircraft type already exists' }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

export async function updateTatRule(id: string, data: {
  aircraft_type_id?: string
  tat_minutes?: number
  tat_dom_dom_minutes?: number | null
  tat_dom_int_minutes?: number | null
  tat_int_dom_minutes?: number | null
  tat_int_int_minutes?: number | null
  notes?: string | null
  is_active?: boolean
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_tat_rules').update(data).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'A TAT rule for this airport and aircraft type already exists' }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

export async function deleteTatRule(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_tat_rules').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/airports')
  return { success: true }
}
