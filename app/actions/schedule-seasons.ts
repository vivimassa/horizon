'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ScheduleSeason } from '@/types/database'

export async function getScheduleSeasons(): Promise<ScheduleSeason[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('schedule_seasons')
    .select('*')
    .order('start_date', { ascending: false })

  if (error) {
    console.error('Error fetching schedule seasons:', error)
    return []
  }

  return data || []
}

export async function createScheduleSeason(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const seasonData = {
    operator_id: operatorId,
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
    status: formData.get('status') as string || 'draft',
  }

  if (!seasonData.code || !seasonData.name || !seasonData.start_date || !seasonData.end_date) {
    return { error: 'All required fields must be filled' }
  }

  const { error } = await supabase
    .from('schedule_seasons')
    .insert(seasonData)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A schedule season with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/schedule-seasons')
  return { success: true }
}

export async function updateScheduleSeason(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const seasonData = {
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    start_date: formData.get('start_date') as string,
    end_date: formData.get('end_date') as string,
    status: formData.get('status') as string || 'draft',
  }

  if (!seasonData.code || !seasonData.name || !seasonData.start_date || !seasonData.end_date) {
    return { error: 'All required fields must be filled' }
  }

  const { error } = await supabase
    .from('schedule_seasons')
    .update(seasonData)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A schedule season with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/schedule-seasons')
  return { success: true }
}

export async function deleteScheduleSeason(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('schedule_seasons')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/schedule-seasons')
  return { success: true }
}
