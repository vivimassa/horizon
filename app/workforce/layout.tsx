import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function WorkforceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="workforce">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 mb-3">
          <h1 className="text-2xl font-bold tracking-tight">Workforce</h1>
          <p className="text-muted-foreground text-sm">
            Manage personnel, scheduling, and team operations
          </p>
        </div>
        <div className="shrink-0"><ModuleTabs moduleBase="/workforce" moduleName="Workforce" /></div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </ModuleGuard>
  )
}
