import { ModuleGuard } from '@/components/guards/module-guard'
import { AdminTabs } from '@/components/navigation/admin-tabs'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="admin">
      <div className="h-full flex flex-col overflow-hidden pt-4">
        <div className="shrink-0">
          <AdminTabs />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </ModuleGuard>
  )
}
