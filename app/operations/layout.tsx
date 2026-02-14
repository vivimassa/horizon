import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="operations">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operations</h1>
          <p className="text-muted-foreground">
            Manage daily operations and workflows
          </p>
        </div>
        <ModuleTabs moduleBase="/operations" moduleName="Operations" />
        {children}
      </div>
    </ModuleGuard>
  )
}
