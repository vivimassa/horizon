import { ModuleGuard } from '@/components/guards/module-guard'
import { ResponsiveAdminSidebar } from '@/components/navigation/responsive-admin-sidebar'
import { ModuleBreadcrumb } from '@/components/navigation/module-breadcrumb'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ModuleGuard module="admin">
      <div className="h-full flex flex-col overflow-hidden pt-4">
        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          <ResponsiveAdminSidebar />
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="shrink-0">
              <ModuleBreadcrumb />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {children}
            </div>
          </div>
        </div>
      </div>
    </ModuleGuard>
  )
}
