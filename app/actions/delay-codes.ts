'use server'

import { createClient, createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { DelayCode } from '@/types/database'

export async function getDelayCodes(): Promise<DelayCode[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('delay_codes')
    .select('*')
    .order('code', { ascending: true })

  if (error) {
    console.error('Error fetching delay codes:', error)
    return []
  }
  return data || []
}

export async function createDelayCode(formData: FormData) {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()

  const codeData = {
    operator_id: operatorId,
    code: formData.get('code') as string,
    category: formData.get('category') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    is_active: formData.get('is_active') !== 'false',
  }

  if (!codeData.code || !codeData.category || !codeData.name) {
    return { error: 'Code, category, and name are required' }
  }

  const { error } = await supabase.from('delay_codes').insert(codeData)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A delay code with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/delay-codes')
  return { success: true }
}

export async function updateDelayCode(id: string, formData: FormData) {
  const supabase = createAdminClient()

  const codeData = {
    code: formData.get('code') as string,
    category: formData.get('category') as string,
    name: formData.get('name') as string,
    description: formData.get('description') as string || null,
    is_active: formData.get('is_active') !== 'false',
  }

  if (!codeData.code || !codeData.category || !codeData.name) {
    return { error: 'Code, category, and name are required' }
  }

  const { error } = await supabase.from('delay_codes').update(codeData).eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'A delay code with this code already exists' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/master-database/delay-codes')
  return { success: true }
}

export async function deleteDelayCode(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('delay_codes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/master-database/delay-codes')
  return { success: true }
}
