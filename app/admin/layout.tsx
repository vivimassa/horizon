import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">
            System administration and configuration
          </p>
        </div>
        <ModuleTabs moduleBase="/admin" moduleName="Admin" />
        {children}
      </div>
    </ModuleGuard>
  )
}
