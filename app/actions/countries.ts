'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
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
  const supabase = createAdminClient()
  const isoCode = formData.get('iso_code') as string
  const countryData = {
    iso_code_2: isoCode,
    iso_code_3: isoCode,
    name: formData.get('name') as string,
    region: formData.get('region') as string,
    currency_code: formData.get('currency') as string,
    icao_prefix: formData.get('icao_prefix') as string,
  }

  if (!countryData.iso_code_2 || !countryData.name || !countryData.region || !countryData.currency_code || !countryData.icao_prefix) {
    return { error: 'All fields are required' }
  }

  if (!/^[A-Z]{2}$/.test(countryData.iso_code_2)) {
    return { error: 'ISO code must be exactly 2 uppercase letters' }
  }

  const { error } = await supabase.from('countries').insert(countryData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A country with this ISO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/countries')
  return { success: true }
}

export async function updateCountry(id: string, formData: FormData) {
  const supabase = createAdminClient()
  const isoCode = formData.get('iso_code') as string
  const countryData = {
    iso_code_2: isoCode,
    iso_code_3: isoCode,
    name: formData.get('name') as string,
    region: formData.get('region') as string,
    currency_code: formData.get('currency') as string,
    icao_prefix: formData.get('icao_prefix') as string,
  }

  if (!countryData.iso_code_2 || !countryData.name || !countryData.region || !countryData.currency_code || !countryData.icao_prefix) {
    return { error: 'All fields are required' }
  }

  if (!/^[A-Z]{2}$/.test(countryData.iso_code_2)) {
    return { error: 'ISO code must be exactly 2 uppercase letters' }
  }

  const { error } = await supabase.from('countries').update(countryData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A country with this ISO code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/countries')
  return { success: true }
}

export async function deleteCountry(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('countries').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/countries')
  return { success: true }
}
