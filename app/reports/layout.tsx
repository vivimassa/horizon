import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="reports">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">
            Enterprise-wide analytics and reporting
          </p>
        </div>
        <ModuleTabs moduleBase="/reports" moduleName="Reports" />
        {children}
      </div>
    </ModuleGuard>
  )
}
