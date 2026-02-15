'use client'

import { useState } from 'react'
import { signIn, type LoginOperator } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Building2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoginFormProps {
  operators: LoginOperator[]
}

export function LoginForm({ operators }: LoginFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(
    operators.length === 1 ? operators[0].id : ''
  )

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    formData.set('operator_id', selectedOperatorId)

    try {
      const result = await signIn(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
      // Success → redirect happens in server action
    } catch {
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Operator selector — hidden if only one operator */}
      {operators.length > 1 && (
        <div className="space-y-2">
          <Label>Operator</Label>
          <div className="space-y-2">
            {operators.map(op => (
              <button
                key={op.id}
                type="button"
                onClick={() => setSelectedOperatorId(op.id)}
                disabled={loading}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 group disabled:opacity-50',
                  selectedOperatorId === op.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-primary/40 hover:bg-primary/5'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {op.logo_url ? (
                    <img
                      src={op.logo_url}
                      alt={op.name}
                      className="h-8 w-8 object-contain"
                    />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{op.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {op.code}{op.iata_code ? ` / ${op.iata_code}` : ''}
                  </p>
                </div>
                {selectedOperatorId === op.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={loading}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>
      {error && (
        <div className="text-sm text-destructive">
          {error}
        </div>
      )}
      <Button type="submit" className="w-full" disabled={loading || !selectedOperatorId}>
        {loading ? 'Signing in...' : 'Sign In'}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="text-primary hover:underline">
          Register
        </Link>
      </div>
    </form>
  )
}
