'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { Operator } from '@/types/database'

export async function getUsers(): Promise<Operator[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
    return []
  }
  return data || []
}

export async function updateUser(id: string, formData: FormData) {
  const supabase = await createClient()

  const userData = {
    full_name: formData.get('full_name') as string || null,
    role: formData.get('role') as string,
    status: formData.get('status') as string,
  }

  if (!userData.role || !userData.status) {
    return { error: 'Role and status are required' }
  }

  const { error } = await supabase
    .from('operators')
    .update(userData)
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/system/users')
  return { success: true }
}

export async function deleteUser(id: string) {
  const supabase = await createClient()

  // Don't allow deleting your own account
  const { data: { user } } = await supabase.auth.getUser()
  const { data: operator } = await supabase
    .from('operators')
    .select('user_id')
    .eq('id', id)
    .single()

  if (operator?.user_id === user?.id) {
    return { error: 'Cannot delete your own account' }
  }

  const { error } = await supabase
    .from('operators')
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/system/users')
  return { success: true }
}
