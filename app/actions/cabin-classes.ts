'use server'

import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { CabinClass } from '@/types/database'

const REVALIDATE_PATH = '/admin/master-database/cabin-classes'

const ALLOWED_FIELDS = [
  'code', 'name', 'color', 'sort_order', 'is_active',
] as const

export async function getCabinClasses(): Promise<CabinClass[]> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  const { data, error } = await supabase
    .from('cabin_classes')
    .select('*')
    .eq('operator_id', operatorId)
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('Error fetching cabin classes:', error)
    return []
  }
  return data || []
}

export async function createCabinClass(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const classData = {
    operator_id: operatorId,
    code: (formData.get('code') as string)?.toUpperCase().trim(),
    name: (formData.get('name') as string)?.trim(),
    color: (formData.get('color') as string) || null,
    sort_order: formData.get('sort_order') ? parseInt(formData.get('sort_order') as string) : null,
    is_active: true,
  }

  if (!classData.code || !classData.name) {
    return { error: 'Code and name are required' }
  }

  const { error } = await supabase.from('cabin_classes').insert(classData)
  if (error) {
    if (error.code === '23505') return { error: 'A cabin class with this code already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateCabinClassField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('cabin_classes')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteCabinClass(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('cabin_classes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
