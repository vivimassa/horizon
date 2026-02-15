'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TimezoneZone } from '@/types/database'

export async function getTimezoneZones(countryId: string): Promise<TimezoneZone[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('timezone_zones')
    .select('*')
    .eq('country_id', countryId)
    .order('zone_code', { ascending: true })

  if (error) {
    console.error('Error fetching timezone zones:', error)
    return []
  }
  return data || []
}

export async function createTimezoneZone(data: {
  country_id: string
  zone_code: string
  zone_name: string
  iana_timezone: string
  utc_offset: string
  dst_observed: boolean
  notes?: string | null
}) {
  if (!data.zone_name || !data.iana_timezone || !data.utc_offset) {
    return { error: 'Zone name, IANA timezone, and UTC offset are required' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase.from('timezone_zones').insert(data)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A zone with this code already exists for this country' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/countries')
  return { success: true }
}

export async function updateTimezoneZone(
  id: string,
  data: {
    zone_code?: string
    zone_name?: string
    iana_timezone?: string
    utc_offset?: string
    dst_observed?: boolean
    is_active?: boolean
    notes?: string | null
  }
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('timezone_zones')
    .update(data)
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/master-database/countries')
  return { success: true }
}

export async function deleteTimezoneZone(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('timezone_zones').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/countries')
  return { success: true }
}
