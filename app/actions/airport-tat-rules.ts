'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface TatRuleWithType {
  id: string
  airport_id: string
  aircraft_type_id: string
  tat_minutes: number
  notes: string | null
  is_active: boolean
  created_at: string
  aircraft_types: { icao_type: string; name: string } | null
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
    .select('*, aircraft_types(icao_type, name)')
    .eq('airport_id', airportId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching TAT rules:', error)
    return []
  }
  return (data as unknown as TatRuleWithType[]) || []
}

export async function createTatRule(formData: FormData) {
  const supabase = createAdminClient()

  const ruleData = {
    airport_id: formData.get('airport_id') as string,
    aircraft_type_id: formData.get('aircraft_type_id') as string,
    tat_minutes: parseInt(formData.get('tat_minutes') as string),
    notes: formData.get('notes') as string || null,
    is_active: formData.get('is_active') !== 'false',
  }

  if (!ruleData.airport_id || !ruleData.aircraft_type_id || !ruleData.tat_minutes) {
    return { error: 'Airport, aircraft type, and TAT minutes are required' }
  }

  const { error } = await supabase.from('airport_tat_rules').insert(ruleData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A TAT rule for this airport and aircraft type already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/airports')
  return { success: true }
}

export async function updateTatRule(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const ruleData = {
    aircraft_type_id: formData.get('aircraft_type_id') as string,
    tat_minutes: parseInt(formData.get('tat_minutes') as string),
    notes: formData.get('notes') as string || null,
    is_active: formData.get('is_active') !== 'false',
  }

  if (!ruleData.aircraft_type_id || !ruleData.tat_minutes) {
    return { error: 'Aircraft type and TAT minutes are required' }
  }

  const { error } = await supabase.from('airport_tat_rules').update(ruleData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A TAT rule for this airport and aircraft type already exists' }
    }
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
