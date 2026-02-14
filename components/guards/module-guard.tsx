import { redirect } from 'next/navigation'
import { getCurrentOperator, hasModuleAccess } from '@/lib/operators'
import { ModuleName } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface ModuleGuardProps {
  module: ModuleName
  children: React.ReactNode
  redirectOnFail?: boolean
}

export async function ModuleGuard({
  module,
  children,
  redirectOnFail = false
}: ModuleGuardProps) {
  const operator = await getCurrentOperator()

  if (!operator) {
    redirect('/login')
  }

  const hasAccess = hasModuleAccess(operator, module)

  if (!hasAccess) {
    if (redirectOnFail) {
      redirect('/')
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <ShieldAlert className="h-5 w-5" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              You don&apos;t have permission to access the <strong>{module}</strong> module.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {module === 'admin'
                ? 'Administrator access is required to view this module. Please contact your system administrator if you need access.'
                : 'This module is not enabled for your account. Please contact your supervisor if you need access.'}
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/">Return to Home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
