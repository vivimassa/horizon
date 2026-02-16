import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function OperationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="operations">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 mb-3">
          <h1 className="text-2xl font-bold tracking-tight">Operations</h1>
          <p className="text-muted-foreground text-sm">
            Manage daily operations and workflows
          </p>
        </div>
        <div className="shrink-0"><ModuleTabs moduleBase="/operations" moduleName="Operations" /></div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </ModuleGuard>
  )
}
