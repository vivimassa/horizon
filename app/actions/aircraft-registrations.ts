'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface AircraftWithType {
  id: string
  operator_id: string
  registration: string
  aircraft_type_id: string
  status: string
  home_base_id: string | null
  seating_config: Record<string, number> | null
  created_at: string
  updated_at: string
  aircraft_types: { icao_type: string; name: string } | null
  airports: { icao_code: string; name: string } | null
}

export async function getAircraftRegistrations(): Promise<AircraftWithType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aircraft')
    .select('*, aircraft_types(icao_type, name), airports:home_base_id(icao_code, name)')
    .order('registration', { ascending: true })

  if (error) {
    console.error('Error fetching aircraft registrations:', error)
    return []
  }
  return (data as unknown as AircraftWithType[]) || []
}

export async function createAircraftRegistration(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  let seatingConfig = null
  const seatingStr = formData.get('seating_config') as string
  if (seatingStr) {
    try { seatingConfig = JSON.parse(seatingStr) } catch { /* ignore */ }
  }

  const regData = {
    operator_id: operatorId,
    registration: formData.get('registration') as string,
    aircraft_type_id: formData.get('aircraft_type_id') as string,
    status: formData.get('status') as string || 'active',
    home_base_id: formData.get('home_base_id') as string || null,
    seating_config: seatingConfig,
  }

  if (!regData.registration || !regData.aircraft_type_id) {
    return { error: 'Registration and aircraft type are required' }
  }

  const { error } = await supabase.from('aircraft').insert(regData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An aircraft with this registration already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/aircraft-registrations')
  return { success: true }
}

export async function updateAircraftRegistration(id: string, formData: FormData) {
  const supabase = createAdminClient()

  let seatingConfig = null
  const seatingStr = formData.get('seating_config') as string
  if (seatingStr) {
    try { seatingConfig = JSON.parse(seatingStr) } catch { /* ignore */ }
  }

  const regData = {
    registration: formData.get('registration') as string,
    aircraft_type_id: formData.get('aircraft_type_id') as string,
    status: formData.get('status') as string || 'active',
    home_base_id: formData.get('home_base_id') as string || null,
    seating_config: seatingConfig,
  }

  if (!regData.registration || !regData.aircraft_type_id) {
    return { error: 'Registration and aircraft type are required' }
  }

  const { error } = await supabase.from('aircraft').update(regData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An aircraft with this registration already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/aircraft-registrations')
  return { success: true }
}

export async function deleteAircraftRegistration(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('aircraft').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/aircraft-registrations')
  return { success: true }
}
