'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AircraftType } from '@/types/database'

export async function getAircraftTypes(): Promise<AircraftType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('aircraft_types')
    .select('*')
    .order('icao_type', { ascending: true })

  if (error) {
    console.error('Error fetching aircraft types:', error)
    return []
  }
  return data || []
}

export async function createAircraftType(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  let defaultCabinConfig = null
  const cabinConfigStr = formData.get('default_cabin_config') as string
  if (cabinConfigStr) {
    try { defaultCabinConfig = JSON.parse(cabinConfigStr) } catch { /* ignore */ }
  }

  const tatStr = formData.get('default_tat_minutes') as string
  const aircraftData = {
    operator_id: operatorId,
    icao_type: formData.get('icao_type') as string,
    iata_type: formData.get('iata_type') as string || null,
    name: formData.get('name') as string,
    family: formData.get('family') as string,
    category: formData.get('category') as string,
    pax_capacity: parseInt(formData.get('pax_capacity') as string) || null,
    cockpit_crew_required: parseInt(formData.get('cockpit_crew') as string) || 2,
    cabin_crew_required: parseInt(formData.get('cabin_crew') as string) || null,
    default_tat_minutes: tatStr ? parseInt(tatStr) : null,
    default_cabin_config: defaultCabinConfig,
  }

  if (!aircraftData.icao_type || !aircraftData.name) {
    return { error: 'All required fields must be filled' }
  }

  const { error } = await supabase.from('aircraft_types').insert(aircraftData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An aircraft type with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/aircraft-types')
  return { success: true }
}

export async function updateAircraftType(id: string, formData: FormData) {
  const supabase = createAdminClient()

  let defaultCabinConfig = null
  const cabinConfigStr = formData.get('default_cabin_config') as string
  if (cabinConfigStr) {
    try { defaultCabinConfig = JSON.parse(cabinConfigStr) } catch { /* ignore */ }
  }

  const tatStr = formData.get('default_tat_minutes') as string
  const aircraftData = {
    icao_type: formData.get('icao_type') as string,
    iata_type: formData.get('iata_type') as string || null,
    name: formData.get('name') as string,
    family: formData.get('family') as string,
    category: formData.get('category') as string,
    pax_capacity: parseInt(formData.get('pax_capacity') as string) || null,
    cockpit_crew_required: parseInt(formData.get('cockpit_crew') as string) || 2,
    cabin_crew_required: parseInt(formData.get('cabin_crew') as string) || null,
    default_tat_minutes: tatStr ? parseInt(tatStr) : null,
    default_cabin_config: defaultCabinConfig,
  }

  if (!aircraftData.icao_type || !aircraftData.name) {
    return { error: 'All required fields must be filled' }
  }

  const { error } = await supabase.from('aircraft_types').update(aircraftData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An aircraft type with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/aircraft-types')
  return { success: true }
}

export async function deleteAircraftType(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('aircraft_types').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/aircraft-types')
  return { success: true }
}
