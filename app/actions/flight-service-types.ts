'use server'

import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FlightServiceType } from '@/types/database'

const REVALIDATE_PATH = '/admin/master-database/flight-service-types'

const ALLOWED_FIELDS = [
  'code', 'name', 'description', 'color', 'is_active',
] as const

export async function getFlightServiceTypes(): Promise<FlightServiceType[]> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  const { data, error } = await supabase
    .from('flight_service_types')
    .select('*')
    .eq('operator_id', operatorId)
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching flight service types:', error)
    return []
  }
  return data || []
}

export async function createFlightServiceType(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const typeData = {
    operator_id: operatorId,
    code: (formData.get('code') as string)?.toUpperCase().trim(),
    name: (formData.get('name') as string)?.trim(),
    description: (formData.get('description') as string) || null,
    color: (formData.get('color') as string) || null,
    is_active: true,
  }

  if (!typeData.code || !typeData.name) {
    return { error: 'Code and name are required' }
  }

  const { error } = await supabase.from('flight_service_types').insert(typeData)
  if (error) {
    if (error.code === '23505') return { error: 'A service type with this code already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateFlightServiceTypeField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('flight_service_types')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteFlightServiceType(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('flight_service_types').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
