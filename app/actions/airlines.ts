'use server'

import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Airline } from '@/types/database'

const REVALIDATE_PATH = '/admin/master-database/airlines'

const ALLOWED_FIELDS = [
  'iata_code', 'icao_code', 'name', 'callsign', 'country',
  'alliance', 'is_active', 'is_own_airline', 'notes',
] as const

export async function getAirlines(): Promise<Airline[]> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('airlines')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching airlines:', error)
    return []
  }
  return data || []
}

export async function createAirline(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const airlineData = {
    operator_id: operatorId,
    iata_code: (formData.get('iata_code') as string)?.toUpperCase().trim() || null,
    icao_code: (formData.get('icao_code') as string)?.toUpperCase().trim(),
    name: (formData.get('name') as string)?.trim(),
    callsign: (formData.get('callsign') as string)?.toUpperCase().trim() || null,
    country: (formData.get('country') as string) || null,
    alliance: (formData.get('alliance') as string) || null,
    is_active: true,
  }

  if (!airlineData.icao_code || !airlineData.name) {
    return { error: 'ICAO code and name are required' }
  }

  const { error } = await supabase.from('airlines').insert(airlineData)
  if (error) {
    if (error.code === '23505') return { error: 'An airline with this code already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateAirlineField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('airlines')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteAirline(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('airlines').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
