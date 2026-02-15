'use server'

import { createAdminClient, getCurrentOperatorId } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { DelayCode } from '@/types/database'

const REVALIDATE_PATH = '/admin/master-database/delay-codes'

const ALLOWED_FIELDS = [
  'code', 'category', 'name', 'description', 'is_active', 'is_iata_standard',
] as const

export async function getDelayCodes(): Promise<DelayCode[]> {
  const supabase = createAdminClient()
  const operatorId = await getCurrentOperatorId()
  const { data, error } = await supabase
    .from('delay_codes')
    .select('*')
    .eq('operator_id', operatorId)
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
    code: (formData.get('code') as string)?.trim(),
    category: (formData.get('category') as string)?.trim(),
    name: (formData.get('name') as string)?.trim(),
    description: (formData.get('description') as string) || null,
    is_active: true,
    is_iata_standard: true,
  }

  if (!codeData.code || !codeData.category || !codeData.name) {
    return { error: 'Code, category, and name are required' }
  }

  const { error } = await supabase.from('delay_codes').insert(codeData)
  if (error) {
    if (error.code === '23505') return { error: 'A delay code with this code already exists' }
    return { error: error.message }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function updateDelayCodeField(
  id: string,
  field: string,
  value: string | number | boolean | null
) {
  if (!(ALLOWED_FIELDS as readonly string[]).includes(field)) {
    return { error: 'Invalid field' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('delay_codes')
    .update({ [field]: value })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}

export async function deleteDelayCode(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('delay_codes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true }
}
