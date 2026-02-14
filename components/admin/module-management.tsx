'use client'

import { useState } from 'react'
import { ModuleDefinition } from '@/types/database'
import { toggleModule } from '@/app/actions/modules'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ArrowRight } from 'lucide-react'

interface ModuleManagementProps {
  modules: ModuleDefinition[]
  enabledModules: string[]
}

export function ModuleManagement({ modules, enabledModules }: ModuleManagementProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const coreModules = modules.filter(m => m.category === 'core')
  const addonModules = modules.filter(m => m.category === 'addon')

  async function handleToggle(moduleKey: string, enabled: boolean) {
    setLoading(moduleKey)
    setError(null)

    const result = await toggleModule(moduleKey, enabled)

    if (result?.error) {
      setError(result.error)
      setLoading(null)
    } else {
      setLoading(null)
      router.refresh()
    }
  }

  function isEnabled(moduleKey: string) {
    return enabledModules.includes(moduleKey)
  }

  function getDependenciesText(dependsOn: string[]) {
    if (!dependsOn || dependsOn.length === 0) return null
    return dependsOn.map(dep => {
      const depModule = modules.find(m => m.module_key === dep)
      return depModule?.module_name || dep
    }).join(', ')
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">Core Modules</h3>
        <div className="space-y-3">
          {coreModules.map(module => {
            const enabled = isEnabled(module.module_key)
            const dependencies = getDependenciesText(module.depends_on)
            const isLoading = loading === module.module_key

            return (
              <div key={module.id} className="flex items-start justify-between p-4 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{module.module_name}</h4>
                    <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
                      {enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {module.description}
                  </p>
                  {dependencies && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <AlertCircle className="h-3 w-3" />
                      <span>Requires: {dependencies}</span>
                    </div>
                  )}
                </div>
                <Switch
                  checked={enabled}
                  onCheckedChange={(checked) => handleToggle(module.module_key, checked)}
                  disabled={isLoading || module.module_key === 'home'}
                />
              </div>
            )
          })}
        </div>
      </div>

      {addonModules.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Add-on Modules</h3>
          <div className="space-y-3">
            {addonModules.map(module => {
              const enabled = isEnabled(module.module_key)
              const dependencies = getDependenciesText(module.depends_on)
              const isLoading = loading === module.module_key

              return (
                <div key={module.id} className="flex items-start justify-between p-4 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{module.module_name}</h4>
                      <Badge variant={enabled ? 'default' : 'secondary'} className="text-xs">
                        {enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {module.description}
                    </p>
                    {dependencies && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="h-3 w-3" />
                        <span>Requires: {dependencies}</span>
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => handleToggle(module.module_key, checked)}
                    disabled={isLoading}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-muted p-4 rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Module Dependencies
        </h4>
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono">operations</span>
            <ArrowRight className="h-3 w-3" />
            <span>requires network</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono">workforce</span>
            <ArrowRight className="h-3 w-3" />
            <span>requires operations</span>
          </div>
          <p className="mt-3 text-xs">
            When enabling a module, its dependencies will be automatically enabled. When disabling a module, you must first disable any modules that depend on it.
          </p>
        </div>
      </div>
    </div>
  )
}
