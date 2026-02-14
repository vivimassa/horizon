'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FlightNumber } from '@/types/database'

export async function getFlightNumbers(seasonId: string): Promise<FlightNumber[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('flight_numbers')
    .select('*')
    .eq('season_id', seasonId)
    .order('flight_number', { ascending: true })

  if (error) {
    console.error('Error fetching flight numbers:', error)
    return []
  }
  return data || []
}

export async function saveFlightNumber(input: {
  id?: string
  season_id: string
  flight_number: string
  departure_iata: string
  arrival_iata: string
  std: string
  sta: string
  block_minutes: number
  days_of_week: string
  aircraft_type_id: string | null
  service_type: string
  effective_from: string | null
  effective_until: string | null
  arrival_day_offset: number
}): Promise<{ id?: string; error?: string }> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const row = {
    operator_id: operatorId,
    season_id: input.season_id,
    flight_number: input.flight_number,
    departure_iata: input.departure_iata,
    arrival_iata: input.arrival_iata,
    std: input.std,
    sta: input.sta,
    block_minutes: input.block_minutes,
    days_of_week: input.days_of_week,
    aircraft_type_id: input.aircraft_type_id || null,
    service_type: input.service_type,
    effective_from: input.effective_from || null,
    effective_until: input.effective_until || null,
    arrival_day_offset: input.arrival_day_offset,
  }

  if (input.id) {
    const { error } = await supabase
      .from('flight_numbers')
      .update(row)
      .eq('id', input.id)
    if (error) {
      if (error.code === '23505') return { error: 'Duplicate flight number in this season' }
      return { error: error.message }
    }
    return { id: input.id }
  } else {
    const { data, error } = await supabase
      .from('flight_numbers')
      .insert(row)
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return { error: 'Duplicate flight number in this season' }
      return { error: error.message }
    }
    return { id: data?.id }
  }
}

export async function deleteFlightNumbers(ids: string[]): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('flight_numbers')
    .delete()
    .in('id', ids)
  if (error) return { error: error.message }
  return {}
}

export async function bulkUpdateFlightNumbers(
  ids: string[],
  changes: Record<string, unknown>
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('flight_numbers')
    .update(changes)
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/network/control/schedule-builder')
  return {}
}
