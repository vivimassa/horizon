'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CityPair } from '@/types/database'

export async function getCityPairs(): Promise<CityPair[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('city_pairs')
    .select('*')
    .order('departure_airport', { ascending: true })

  if (error) {
    console.error('Error fetching city pairs:', error)
    return []
  }
  return data || []
}

export async function createCityPair(formData: FormData) {
  const supabase = await createClient()
  const cityPairData = {
    departure_airport: formData.get('departure_airport') as string,
    arrival_airport: formData.get('arrival_airport') as string,
    block_time: parseInt(formData.get('block_time') as string),
    distance: parseInt(formData.get('distance') as string),
    route_type: formData.get('route_type') as string,
    etops_required: formData.get('etops_required') === 'true',
  }

  if (!cityPairData.departure_airport || !cityPairData.arrival_airport || !cityPairData.route_type) {
    return { error: 'Departure airport, arrival airport, and route type are required' }
  }

  if (!/^[A-Z]{4}$/.test(cityPairData.departure_airport) || !/^[A-Z]{4}$/.test(cityPairData.arrival_airport)) {
    return { error: 'Airport codes must be valid 4-letter ICAO codes' }
  }

  if (cityPairData.departure_airport === cityPairData.arrival_airport) {
    return { error: 'Departure and arrival airports cannot be the same' }
  }

  const { error } = await supabase.from('city_pairs').insert(cityPairData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'This city pair already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/city-pairs')
  return { success: true }
}

export async function updateCityPair(id: string, formData: FormData) {
  const supabase = await createClient()
  const cityPairData = {
    departure_airport: formData.get('departure_airport') as string,
    arrival_airport: formData.get('arrival_airport') as string,
    block_time: parseInt(formData.get('block_time') as string),
    distance: parseInt(formData.get('distance') as string),
    route_type: formData.get('route_type') as string,
    etops_required: formData.get('etops_required') === 'true',
  }

  if (!cityPairData.departure_airport || !cityPairData.arrival_airport || !cityPairData.route_type) {
    return { error: 'Departure airport, arrival airport, and route type are required' }
  }

  if (!/^[A-Z]{4}$/.test(cityPairData.departure_airport) || !/^[A-Z]{4}$/.test(cityPairData.arrival_airport)) {
    return { error: 'Airport codes must be valid 4-letter ICAO codes' }
  }

  if (cityPairData.departure_airport === cityPairData.arrival_airport) {
    return { error: 'Departure and arrival airports cannot be the same' }
  }

  const { error } = await supabase.from('city_pairs').update(cityPairData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'This city pair already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/city-pairs')
  return { success: true }
}

export async function deleteCityPair(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('city_pairs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/reference-data/city-pairs')
  return { success: true }
}
