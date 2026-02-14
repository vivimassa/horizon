'use server'

import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()
  const aircraftData = {
    icao_type: formData.get('icao_type') as string,
    iata_type: formData.get('iata_type') as string || null,
    name: formData.get('name') as string,
    family: formData.get('family') as string,
    category: formData.get('category') as string,
    pax_capacity: parseInt(formData.get('pax_capacity') as string),
    cockpit_crew: parseInt(formData.get('cockpit_crew') as string),
    cabin_crew: parseInt(formData.get('cabin_crew') as string),
  }

  if (!aircraftData.icao_type || !aircraftData.name || !aircraftData.family || !aircraftData.category) {
    return { error: 'All required fields must be filled' }
  }

  if (!/^[A-Z0-9]{3,4}$/.test(aircraftData.icao_type)) {
    return { error: 'ICAO type must be 3-4 uppercase alphanumeric characters' }
  }

  const { error } = await supabase.from('aircraft_types').insert(aircraftData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An aircraft type with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/aircraft-types')
  return { success: true }
}

export async function updateAircraftType(id: string, formData: FormData) {
  const supabase = await createClient()
  const aircraftData = {
    icao_type: formData.get('icao_type') as string,
    iata_type: formData.get('iata_type') as string || null,
    name: formData.get('name') as string,
    family: formData.get('family') as string,
    category: formData.get('category') as string,
    pax_capacity: parseInt(formData.get('pax_capacity') as string),
    cockpit_crew: parseInt(formData.get('cockpit_crew') as string),
    cabin_crew: parseInt(formData.get('cabin_crew') as string),
  }

  if (!aircraftData.icao_type || !aircraftData.name || !aircraftData.family || !aircraftData.category) {
    return { error: 'All required fields must be filled' }
  }

  if (!/^[A-Z0-9]{3,4}$/.test(aircraftData.icao_type)) {
    return { error: 'ICAO type must be 3-4 uppercase alphanumeric characters' }
  }

  const { error } = await supabase.from('aircraft_types').update(aircraftData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An aircraft type with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/aircraft-types')
  return { success: true }
}

export async function deleteAircraftType(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('aircraft_types').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/reference-data/aircraft-types')
  return { success: true }
}
