'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { MessageLog } from '@/types/database'

export async function getMessageLog(input: {
  direction?: string
  action_code?: string
  flight_number?: string
  limit?: number
}): Promise<MessageLog[]> {
  const supabase = await createClient()
  const operatorId = await getCurrentOperatorId()

  let query = supabase
    .from('message_log')
    .select('*')
    .eq('operator_id', operatorId)
    .order('created_at', { ascending: false })
    .limit(input.limit || 100)

  if (input.direction) query = query.eq('direction', input.direction)
  if (input.action_code) query = query.eq('action_code', input.action_code)
  if (input.flight_number) query = query.ilike('flight_number', `%${input.flight_number}%`)

  const { data, error } = await query
  if (error) { console.error('Error fetching message log:', error); return [] }
  return (data as MessageLog[]) || []
}

export async function createMessage(input: {
  message_type: string
  action_code: string
  direction: string
  flight_number?: string
  flight_date?: string
  status?: string
  summary?: string
  raw_message?: string
  changes?: Record<string, unknown>
}): Promise<{ id?: string; error?: string }> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  const { data, error } = await supabase
    .from('message_log')
    .insert({
      operator_id: operatorId,
      message_type: input.message_type,
      action_code: input.action_code,
      direction: input.direction,
      flight_number: input.flight_number || null,
      flight_date: input.flight_date || null,
      status: input.status || 'pending',
      summary: input.summary || null,
      raw_message: input.raw_message || null,
      changes: input.changes || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/network/control/schedule-messages')
  return { id: data?.id }
}

export async function updateMessageStatus(
  id: string,
  status: string,
  rejectReason?: string
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const update: Record<string, unknown> = { status }
  if (rejectReason) update.reject_reason = rejectReason

  const { error } = await supabase
    .from('message_log')
    .update(update)
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/network/control/schedule-messages')
  return {}
}

/** Apply an inbound ASM message: update scheduled_flights or flights table */
export async function applyAsmMessage(input: {
  message_id: string
  action_code: string
  flight_number: string
  flight_date?: string
  changes: Record<string, { from?: string; to: string }>
  season_id?: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  if (input.action_code === 'CNL' && input.flight_date) {
    // Cancel a specific flight instance
    const { error } = await supabase
      .from('flights')
      .update({ status: 'cancelled' })
      .eq('operator_id', operatorId)
      .eq('flight_number', input.flight_number)
      .eq('flight_date', input.flight_date)

    if (error) return { error: error.message }
  } else if (input.action_code === 'TIM' && input.flight_date) {
    // Time change on specific flight
    const update: Record<string, string> = {}
    if (input.changes['std']) update.std_local = input.changes['std'].to
    if (input.changes['sta']) update.sta_local = input.changes['sta'].to

    if (Object.keys(update).length > 0) {
      const { error } = await supabase
        .from('flights')
        .update(update)
        .eq('operator_id', operatorId)
        .eq('flight_number', input.flight_number)
        .eq('flight_date', input.flight_date)

      if (error) return { error: error.message }
    }
  } else if (input.action_code === 'EQT') {
    // Equipment change — update scheduled_flights template
    if (input.changes['aircraft_type']) {
      const iataType = input.changes['aircraft_type'].to
      const { data: acType } = await supabase
        .from('aircraft_types')
        .select('id')
        .or(`iata_type.eq.${iataType},icao_type.eq.${iataType}`)
        .limit(1)
        .maybeSingle()

      if (acType) {
        // Split flight number (e.g. "VJ120") to match scheduled_flights
        const fnMatch = input.flight_number.match(/^([A-Z]{2})(\d+)$/)
        if (fnMatch) {
          const { error } = await supabase
            .from('scheduled_flights')
            .update({ aircraft_type_id: acType.id })
            .eq('operator_id', operatorId)
            .eq('airline_code', fnMatch[1])
            .eq('flight_number', parseInt(fnMatch[2]))

          if (error) return { error: error.message }
        }
      } else {
        return { error: `Unknown aircraft type: ${iataType}` }
      }
    }
  } else if (input.action_code === 'RIN' && input.flight_date) {
    // Reinstatement — un-cancel
    const { error } = await supabase
      .from('flights')
      .update({ status: 'scheduled' })
      .eq('operator_id', operatorId)
      .eq('flight_number', input.flight_number)
      .eq('flight_date', input.flight_date)

    if (error) return { error: error.message }
  }

  // Mark message as applied
  await supabase
    .from('message_log')
    .update({ status: 'applied' })
    .eq('id', input.message_id)

  revalidatePath('/network/control/schedule-messages')
  revalidatePath('/network/control/schedule-builder')
  return {}
}
