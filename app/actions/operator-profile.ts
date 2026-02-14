'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Type for the operator (company profile)
export type OperatorProfile = {
  id: string
  code: string
  iata_code: string | null
  name: string // company_name equivalent
  country: string
  regulatory_authority: string
  timezone: string
  enabled_modules: string[]
  created_at: string
  updated_at: string
}

export async function getOperatorProfile(): Promise<OperatorProfile | null> {
  // Use admin client to bypass RLS for reading operator profile (company-wide data)
  const supabase = createAdminClient()

  // Get the first operator (there should typically be only one company profile)
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('Error fetching operator profile:', error)
    return null
  }

  return data
}

export async function updateOperatorProfile(id: string, formData: FormData) {
  const supabase = await createClient()

  const profileData = {
    name: formData.get('company_name') as string, // Map company_name to name
    code: formData.get('icao_code') as string || null, // Map icao_code to code
    iata_code: formData.get('iata_code') as string || null,
    country: formData.get('country') as string,
    regulatory_authority: formData.get('regulatory_authority') as string,
    timezone: formData.get('timezone') as string,
  }

  if (!profileData.name || !profileData.country || !profileData.regulatory_authority || !profileData.timezone) {
    return { error: 'Company name, country, regulatory authority, and timezone are required' }
  }

  // Validate code (ICAO) if provided
  if (profileData.code && !/^[A-Z]{3}$/.test(profileData.code)) {
    return { error: 'ICAO code must be exactly 3 uppercase letters' }
  }

  // Validate IATA code if provided
  if (profileData.iata_code && !/^[A-Z0-9]{2}$/.test(profileData.iata_code)) {
    return { error: 'IATA code must be exactly 2 uppercase alphanumeric characters' }
  }

  const { error } = await supabase
    .from('operators')
    .update(profileData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/system/operator-profile')
  return { success: true }
}
