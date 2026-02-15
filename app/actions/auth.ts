'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

const OPERATOR_COOKIE = 'horizon_operator_id'

export type LoginOperator = {
  id: string
  code: string
  iata_code: string | null
  name: string
  logo_url: string | null
}

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  const { error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const operatorId = formData.get('operator_id') as string

  if (!email || !password) {
    return { error: 'Email and password are required' }
  }

  if (!operatorId) {
    return { error: 'Please select an operator' }
  }

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Validate user has access to the selected operator
  const admin = createAdminClient()
  const { data: role } = await admin
    .from('user_roles')
    .select('operator_id')
    .eq('user_id', authData.user.id)
    .eq('operator_id', operatorId)
    .maybeSingle()

  if (!role) {
    // Sign out — user doesn't have access to this operator
    await supabase.auth.signOut()
    return { error: 'You do not have access to the selected operator' }
  }

  // Set operator cookie and redirect
  const cookieStore = await cookies()
  cookieStore.set(OPERATOR_COOKIE, operatorId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 365 * 24 * 60 * 60,
  })
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()

  // Clear operator cookie
  const cookieStore = await cookies()
  cookieStore.delete(OPERATOR_COOKIE)

  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function changePassword(newPassword: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  if (!newPassword || newPassword.length < 6) {
    return { error: 'Password must be at least 6 characters' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: error.message }
  }

  return {}
}
