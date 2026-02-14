import { ModuleGuard } from '@/components/guards/module-guard'
import { ModuleTabs } from '@/components/navigation/module-tabs'

export default function NetworkLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="network">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network</h1>
          <p className="text-muted-foreground">
            Manage network infrastructure and connectivity
          </p>
        </div>
        <ModuleTabs moduleBase="/network" moduleName="Network" />
        {children}
      </div>
    </ModuleGuard>
  )
}
