'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { ServiceType } from '@/types/database'

export async function getServiceTypes(): Promise<ServiceType[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('service_types')
    .select('*')
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching service types:', error)
    return []
  }

  return data || []
}

export async function createServiceType(formData: FormData) {
  const supabase = createAdminClient()

  const serviceData = {
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    color: formData.get('color') as string || '#6B9DAD',
  }

  if (!serviceData.code || !serviceData.name) {
    return { error: 'Code and name are required' }
  }

  const { error } = await supabase
    .from('service_types')
    .insert(serviceData)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A service type with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/service-types')
  return { success: true }
}

export async function updateServiceType(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const serviceData = {
    code: formData.get('code') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    color: formData.get('color') as string || '#6B9DAD',
  }

  if (!serviceData.code || !serviceData.name) {
    return { error: 'Code and name are required' }
  }

  const { error } = await supabase
    .from('service_types')
    .update(serviceData)
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { error: 'A service type with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/service-types')
  return { success: true }
}

export async function deleteServiceType(id: string) {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('service_types')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/network-config/service-types')
  return { success: true }
}
