import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="reports">
      <div className="h-full flex flex-col overflow-hidden pt-4">
        <div className="shrink-0"><ModuleTabs moduleBase="/reports" moduleName="Reports" /></div>
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </ModuleGuard>
  )
}
