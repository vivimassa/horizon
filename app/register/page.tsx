import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RegisterForm } from '@/components/auth/register-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HorizonLogo } from '@/components/horizon-logo'

export default async function RegisterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-scale-up">
        <div className="flex flex-col items-center">
          <HorizonLogo variant="full" />
          <p className="mt-3 text-muted-foreground">Create your account</p>
        </div>
        <Card className="shadow-glass-lg">
          <CardHeader>
            <CardTitle>Register</CardTitle>
            <CardDescription>
              Sign up to get started with Horizon
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
