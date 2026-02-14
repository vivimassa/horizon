'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Airline } from '@/types/database'

export async function getAirlines(): Promise<Airline[]> {
  const supabase = await createClient()
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
  const supabase = await createClient()
  const airlineData = {
    icao_code: formData.get('icao_code') as string,
    iata_code: formData.get('iata_code') as string || null,
    name: formData.get('name') as string,
    country: formData.get('country') as string,
    alliance: formData.get('alliance') as string || null,
  }

  if (!airlineData.icao_code || !airlineData.name || !airlineData.country) {
    return { error: 'ICAO code, name, and country are required' }
  }

  if (!/^[A-Z]{3}$/.test(airlineData.icao_code)) {
    return { error: 'ICAO code must be exactly 3 uppercase letters' }
  }

  if (airlineData.iata_code && !/^[A-Z0-9]{2}$/.test(airlineData.iata_code)) {
    return { error: 'IATA code must be exactly 2 uppercase alphanumeric characters' }
  }

  const { error } = await supabase.from('airlines').insert(airlineData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An airline with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/airlines')
  return { success: true }
}

export async function updateAirline(id: string, formData: FormData) {
  const supabase = await createClient()
  const airlineData = {
    icao_code: formData.get('icao_code') as string,
    iata_code: formData.get('iata_code') as string || null,
    name: formData.get('name') as string,
    country: formData.get('country') as string,
    alliance: formData.get('alliance') as string || null,
  }

  if (!airlineData.icao_code || !airlineData.name || !airlineData.country) {
    return { error: 'ICAO code, name, and country are required' }
  }

  if (!/^[A-Z]{3}$/.test(airlineData.icao_code)) {
    return { error: 'ICAO code must be exactly 3 uppercase letters' }
  }

  if (airlineData.iata_code && !/^[A-Z0-9]{2}$/.test(airlineData.iata_code)) {
    return { error: 'IATA code must be exactly 2 uppercase alphanumeric characters' }
  }

  const { error } = await supabase.from('airlines').update(airlineData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'An airline with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/airlines')
  return { success: true }
}

export async function deleteAirline(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('airlines').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/reference-data/airlines')
  return { success: true }
}
