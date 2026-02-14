'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Airport } from '@/types/database'

export async function getAirports(): Promise<Airport[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('airports')
    .select('*')
    .order('icao_code', { ascending: true })

  if (error) {
    console.error('Error fetching airports:', error)
    return []
  }

  return data || []
}

export async function createAirport(formData: FormData) {
  const supabase = await createClient()

  const airportData = {
    icao_code: formData.get('icao_code') as string,
    iata_code: formData.get('iata_code') as string || null,
    airport_name: formData.get('airport_name') as string,
    city: formData.get('city') as string,
    country: formData.get('country') as string,
    timezone: formData.get('timezone') as string,
  }

  // Validate required fields
  if (!airportData.icao_code || !airportData.airport_name || !airportData.city || !airportData.country || !airportData.timezone) {
    return { error: 'All required fields must be filled' }
  }

  // Validate ICAO code format (4 letters)
  if (!/^[A-Z]{4}$/.test(airportData.icao_code)) {
    return { error: 'ICAO code must be exactly 4 uppercase letters' }
  }

  // Validate IATA code format if provided (3 letters)
  if (airportData.iata_code && !/^[A-Z]{3}$/.test(airportData.iata_code)) {
    return { error: 'IATA code must be exactly 3 uppercase letters' }
  }

  const { error } = await supabase
    .from('airports')
    .insert(airportData)

  if (error) {
    if (error.code === '23505') {
      return { error: 'An airport with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/airports')
  return { success: true }
}

export async function updateAirport(id: string, formData: FormData) {
  const supabase = await createClient()

  const airportData = {
    icao_code: formData.get('icao_code') as string,
    iata_code: formData.get('iata_code') as string || null,
    airport_name: formData.get('airport_name') as string,
    city: formData.get('city') as string,
    country: formData.get('country') as string,
    timezone: formData.get('timezone') as string,
  }

  // Validate required fields
  if (!airportData.icao_code || !airportData.airport_name || !airportData.city || !airportData.country || !airportData.timezone) {
    return { error: 'All required fields must be filled' }
  }

  // Validate ICAO code format (4 letters)
  if (!/^[A-Z]{4}$/.test(airportData.icao_code)) {
    return { error: 'ICAO code must be exactly 4 uppercase letters' }
  }

  // Validate IATA code format if provided (3 letters)
  if (airportData.iata_code && !/^[A-Z]{3}$/.test(airportData.iata_code)) {
    return { error: 'IATA code must be exactly 3 uppercase letters' }
  }

  const { error } = await supabase
    .from('airports')
    .update(airportData)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'An airport with this ICAO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/airports')
  return { success: true }
}

export async function deleteAirport(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('airports')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/airports')
  return { success: true }
}
