'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CabinConfiguration } from '@/types/database'

export async function getCabinConfigurations(): Promise<CabinConfiguration[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cabin_configurations')
    .select('*')
    .order('aircraft_type', { ascending: true })

  if (error) {
    console.error('Error fetching cabin configurations:', error)
    return []
  }

  return data || []
}

export async function createCabinConfiguration(formData: FormData) {
  const supabase = createAdminClient()

  const cabinsJson = formData.get('cabins') as string
  let cabins
  try {
    cabins = JSON.parse(cabinsJson)
  } catch {
    return { error: 'Invalid cabin data' }
  }

  const totalSeats = cabins.reduce((sum: number, c: { seats: number }) => sum + c.seats, 0)

  const configData = {
    aircraft_type: formData.get('aircraft_type') as string,
    name: formData.get('name') as string,
    cabins,
    total_seats: totalSeats,
  }

  if (!configData.aircraft_type || !configData.name) {
    return { error: 'Aircraft type and name are required' }
  }

  if (!cabins.length) {
    return { error: 'At least one cabin must be defined' }
  }

  const { error } = await supabase
    .from('cabin_configurations')
    .insert(configData)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A cabin configuration with this aircraft type and name already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/cabin-config')
  return { success: true }
}

export async function updateCabinConfiguration(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const cabinsJson = formData.get('cabins') as string
  let cabins
  try {
    cabins = JSON.parse(cabinsJson)
  } catch {
    return { error: 'Invalid cabin data' }
  }

  const totalSeats = cabins.reduce((sum: number, c: { seats: number }) => sum + c.seats, 0)

  const configData = {
    aircraft_type: formData.get('aircraft_type') as string,
    name: formData.get('name') as string,
    cabins,
    total_seats: totalSeats,
  }

  if (!configData.aircraft_type || !configData.name) {
    return { error: 'Aircraft type and name are required' }
  }

  if (!cabins.length) {
    return { error: 'At least one cabin must be defined' }
  }

  const { error } = await supabase
    .from('cabin_configurations')
    .update(configData)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A cabin configuration with this aircraft type and name already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/cabin-config')
  return { success: true }
}

export async function deleteCabinConfiguration(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('cabin_configurations')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/cabin-config')
  return { success: true }
}
