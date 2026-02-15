'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import {
  AirportRunway,
  AirportTerminal,
  AirportCurfew,
  AirportFrequency,
  AirportWeatherLimit,
} from '@/types/database'

const PATH = '/admin/master-database/airports'

// ═══════════════════════════════════════════════════════════════════════════
// RUNWAYS
// ═══════════════════════════════════════════════════════════════════════════

export async function getRunways(airportId: string): Promise<AirportRunway[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_runways')
    .select('*')
    .eq('airport_id', airportId)
    .order('identifier')
  if (error) { console.error('Error fetching runways:', error); return [] }
  return data || []
}

export async function createRunway(data: {
  airport_id: string
  identifier: string
  length_m?: number | null
  width_m?: number | null
  surface?: string | null
  ils_category?: string | null
  lighting?: boolean
  status?: string
  notes?: string | null
}) {
  if (!data.identifier) return { error: 'Identifier is required' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_runways').insert(data)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function updateRunway(id: string, data: Partial<Omit<AirportRunway, 'id' | 'created_at'>>) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_runways').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteRunway(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_runways').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// TERMINALS
// ═══════════════════════════════════════════════════════════════════════════

export async function getTerminals(airportId: string): Promise<AirportTerminal[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_terminals')
    .select('*')
    .eq('airport_id', airportId)
    .order('code')
  if (error) { console.error('Error fetching terminals:', error); return [] }
  return data || []
}

export async function createTerminal(data: {
  airport_id: string
  code: string
  name?: string | null
  notes?: string | null
}) {
  if (!data.code) return { error: 'Code is required' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_terminals').insert(data)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function updateTerminal(id: string, data: Partial<Omit<AirportTerminal, 'id' | 'created_at'>>) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_terminals').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteTerminal(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_terminals').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// CURFEWS
// ═══════════════════════════════════════════════════════════════════════════

export async function getCurfews(airportId: string): Promise<AirportCurfew[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_curfews')
    .select('*')
    .eq('airport_id', airportId)
    .order('created_at')
  if (error) { console.error('Error fetching curfews:', error); return [] }
  return data || []
}

export async function createCurfew(data: {
  airport_id: string
  days?: string
  no_ops_from: string
  no_ops_until: string
  exception?: string | null
  notes?: string | null
}) {
  if (!data.no_ops_from || !data.no_ops_until) return { error: 'Times are required' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_curfews').insert(data)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function updateCurfew(id: string, data: Partial<Omit<AirportCurfew, 'id' | 'created_at'>>) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_curfews').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteCurfew(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_curfews').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// FREQUENCIES
// ═══════════════════════════════════════════════════════════════════════════

export async function getFrequencies(airportId: string): Promise<AirportFrequency[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_frequencies')
    .select('*')
    .eq('airport_id', airportId)
    .order('type')
  if (error) { console.error('Error fetching frequencies:', error); return [] }
  return data || []
}

export async function createFrequency(data: {
  airport_id: string
  type: string
  frequency: string
  notes?: string | null
}) {
  if (!data.type || !data.frequency) return { error: 'Type and frequency are required' }
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_frequencies').insert(data)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function updateFrequency(id: string, data: Partial<Omit<AirportFrequency, 'id' | 'created_at'>>) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_frequencies').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteFrequency(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_frequencies').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

// ═══════════════════════════════════════════════════════════════════════════
// WEATHER LIMITS
// ═══════════════════════════════════════════════════════════════════════════

export async function getWeatherLimits(airportId: string): Promise<AirportWeatherLimit[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('airport_weather_limits')
    .select('*')
    .eq('airport_id', airportId)
    .order('limitation_type')
  if (error) { console.error('Error fetching weather limits:', error); return [] }
  return data || []
}

export async function upsertWeatherLimit(data: {
  airport_id: string
  limitation_type: string
  warning_value: number | null
  alert_value: number | null
  unit: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('airport_weather_limits')
    .upsert(data, { onConflict: 'airport_id,limitation_type' })
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}

export async function deleteWeatherLimit(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airport_weather_limits').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(PATH)
  return { success: true }
}
