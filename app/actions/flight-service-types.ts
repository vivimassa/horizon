'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { FlightServiceType } from '@/types/database'

export async function getFlightServiceTypes(): Promise<FlightServiceType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('flight_service_types')
    .select('*')
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

  const fstData = {
    operator_id: operatorId,
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    color: formData.get('color') as string || null,
    is_active: formData.get('is_active') !== 'false',
  }

  if (!fstData.code || !fstData.name) {
    return { error: 'Code and name are required' }
  }

  const { error } = await supabase.from('flight_service_types').insert(fstData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A flight service type with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/flight-service-types')
  return { success: true }
}

export async function updateFlightServiceType(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const fstData = {
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    color: formData.get('color') as string || null,
    is_active: formData.get('is_active') !== 'false',
  }

  if (!fstData.code || !fstData.name) {
    return { error: 'Code and name are required' }
  }

  const { error } = await supabase.from('flight_service_types').update(fstData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A flight service type with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/flight-service-types')
  return { success: true }
}

export async function deleteFlightServiceType(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('flight_service_types').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/flight-service-types')
  return { success: true }
}
