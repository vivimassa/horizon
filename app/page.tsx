import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import { getCurrentOperator, isAdmin as checkAdmin } from '@/lib/operators'
import { getShortcuts } from '@/app/actions/shortcuts'
import { Launchpad } from '@/components/myhorizon/launchpad'

export default async function Home() {
  const user = await getAuthUser()

  if (!user) {
    redirect('/login')
  }

  const [operator, shortcuts] = await Promise.all([
    getCurrentOperator(),
    getShortcuts(),
  ])

  const admin = checkAdmin(operator)
  const enabledModules = [
    ...(operator?.enabled_modules || []),
    ...(admin ? ['admin'] : []),
  ]

  return (
    <Launchpad
      enabledModules={enabledModules}
      initialShortcuts={shortcuts}
    />
  )
}
