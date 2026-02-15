import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentOperator, isAdmin as checkAdmin } from '@/lib/operators'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { Launchpad } from '@/components/myhorizon/launchpad'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const operator = await getCurrentOperator()
  const profile = await getOperatorProfile()

  const enabledModules = profile?.enabled_modules || []
  const userName = user.email?.split('@')[0] || 'User'
  const userRole = operator?.user_role || 'operator'
  const admin = checkAdmin(operator)

  return (
    <Launchpad
      userName={userName}
      userRole={userRole}
      isAdmin={admin}
      enabledModules={enabledModules}
      currentOperatorId={operator?.id}
      operatorLogoUrl={operator?.logo_url}
    />
  )
}
