import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="reports">
      <div className="h-full flex flex-col overflow-hidden">
        <div className="shrink-0 mb-3">
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm">
            Enterprise-wide analytics and reporting
          </p>
        </div>
        <div className="shrink-0"><ModuleTabs moduleBase="/reports" moduleName="Reports" /></div>
        <div className="flex-1 min-h-0 overflow-hidden mt-3">{children}</div>
      </div>
    </ModuleGuard>
  )
}
