'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

const OPERATOR_COOKIE = 'horizon_operator_id'

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
  logo_url: string | null
  created_at: string
  updated_at: string
}

export async function getOperatorProfile(): Promise<OperatorProfile | null> {
  try {
    const cookieStore = await cookies()
    const selectedId = cookieStore.get(OPERATOR_COOKIE)?.value
    const supabase = createAdminClient()

    let query = supabase.from('operators').select('*')

    if (selectedId) {
      query = query.eq('id', selectedId)
    }

    const { data, error } = await query.limit(1).maybeSingle()

    if (error) {
      console.error('Error fetching operator profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('getOperatorProfile failed (possible network timeout):', error)
    return null
  }
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

const ALLOWED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml']
const MAX_LOGO_SIZE = 2 * 1024 * 1024 // 2MB

export async function uploadOperatorLogo(operatorId: string, formData: FormData) {
  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) {
    return { error: 'No file provided' }
  }

  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: 'Invalid file type. Allowed: JPG, PNG, SVG' }
  }

  if (file.size > MAX_LOGO_SIZE) {
    return { error: 'File too large. Maximum size is 2MB' }
  }

  const supabase = createAdminClient()

  // Generate a unique filename
  const ext = file.name.split('.').pop()
  const fileName = `${operatorId}/logo-${Date.now()}.${ext}`

  // Delete any existing logo files for this operator
  const { data: existing } = await supabase.storage
    .from('operator-logos')
    .list(operatorId)

  if (existing && existing.length > 0) {
    const filesToRemove = existing.map(f => `${operatorId}/${f.name}`)
    await supabase.storage.from('operator-logos').remove(filesToRemove)
  }

  // Upload new file
  const { error: uploadError } = await supabase.storage
    .from('operator-logos')
    .upload(fileName, file, { cacheControl: '3600', upsert: true })

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` }
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('operator-logos')
    .getPublicUrl(fileName)

  // Update operator record
  const { error: updateError } = await supabase
    .from('operators')
    .update({ logo_url: urlData.publicUrl })
    .eq('id', operatorId)

  if (updateError) {
    return { error: `Failed to save logo URL: ${updateError.message}` }
  }

  revalidatePath('/admin/system/operator-profile')
  revalidatePath('/')
  return { success: true, logoUrl: urlData.publicUrl }
}

export async function removeOperatorLogo(operatorId: string) {
  const supabase = createAdminClient()

  // Delete files from storage
  const { data: existing } = await supabase.storage
    .from('operator-logos')
    .list(operatorId)

  if (existing && existing.length > 0) {
    const filesToRemove = existing.map(f => `${operatorId}/${f.name}`)
    await supabase.storage.from('operator-logos').remove(filesToRemove)
  }

  // Clear logo_url on operator
  const { error } = await supabase
    .from('operators')
    .update({ logo_url: null })
    .eq('id', operatorId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/system/operator-profile')
  revalidatePath('/')
  return { success: true }
}
