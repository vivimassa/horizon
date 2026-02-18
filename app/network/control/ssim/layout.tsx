import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function SSIMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="p-6 pb-8 space-y-4">
          {/* Breadcrumb */}
          <div className="animate-fade-in flex items-center gap-3">
            <Link
              href="/network/control"
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <p className="text-[11px] text-muted-foreground">
              Network &gt; Control &gt; SSIM Exchange
            </p>
          </div>

          {/* Page content */}
          {children}
        </div>
      </div>
    </div>
  )
}
