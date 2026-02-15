import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/login-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HorizonLogo } from '@/components/horizon-logo'
import type { LoginOperator } from '@/app/actions/auth'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  // Fetch all active operators for the pre-auth selector
  const admin = createAdminClient()
  const { data: operators } = await admin
    .from('operators')
    .select('id, name, code, iata_code, logo_url')
    .order('name')

  const operatorList: LoginOperator[] = (operators ?? []).map(op => ({
    id: op.id,
    name: op.name,
    code: op.code,
    iata_code: op.iata_code,
    logo_url: op.logo_url,
  }))

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-scale-up">
        <div className="flex flex-col items-center">
          <HorizonLogo variant="full" />
          <p className="mt-3 text-muted-foreground">Welcome back</p>
        </div>
        <Card className="shadow-glass-lg">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm operators={operatorList} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
