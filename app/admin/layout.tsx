import { ModuleGuard } from '@/components/guards/module-guard'
import { AdminSidebar } from '@/components/navigation/admin-sidebar'

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
        <div className="flex gap-6">
          <AdminSidebar />
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
