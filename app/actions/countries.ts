'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Country } from '@/types/database'

export async function getCountries(): Promise<Country[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('countries')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching countries:', error)
    return []
  }
  return data || []
}

export async function createCountry(formData: FormData) {
  const supabase = await createClient()
  const countryData = {
    iso_code: formData.get('iso_code') as string,
    name: formData.get('name') as string,
    region: formData.get('region') as string,
    currency: formData.get('currency') as string,
    icao_prefix: formData.get('icao_prefix') as string,
  }

  if (!countryData.iso_code || !countryData.name || !countryData.region || !countryData.currency || !countryData.icao_prefix) {
    return { error: 'All fields are required' }
  }

  if (!/^[A-Z]{2}$/.test(countryData.iso_code)) {
    return { error: 'ISO code must be exactly 2 uppercase letters' }
  }

  const { error } = await supabase.from('countries').insert(countryData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A country with this ISO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/countries')
  return { success: true }
}

export async function updateCountry(id: string, formData: FormData) {
  const supabase = await createClient()
  const countryData = {
    iso_code: formData.get('iso_code') as string,
    name: formData.get('name') as string,
    region: formData.get('region') as string,
    currency: formData.get('currency') as string,
    icao_prefix: formData.get('icao_prefix') as string,
  }

  if (!countryData.iso_code || !countryData.name || !countryData.region || !countryData.currency || !countryData.icao_prefix) {
    return { error: 'All fields are required' }
  }

  if (!/^[A-Z]{2}$/.test(countryData.iso_code)) {
    return { error: 'ISO code must be exactly 2 uppercase letters' }
  }

  const { error } = await supabase.from('countries').update(countryData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A country with this ISO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/reference-data/countries')
  return { success: true }
}

export async function deleteCountry(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('countries').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/reference-data/countries')
  return { success: true }
}
