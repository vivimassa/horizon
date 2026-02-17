import Link from 'next/link'
import { ArrowLeft, Plane } from 'lucide-react'

export default function CharterManagerPage() {
  return (
    <div className="space-y-6 p-6 overflow-y-auto h-full custom-scrollbar">
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href="/network/control"
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="text-[11px] text-muted-foreground">Network &gt; Control</p>
            <h1 className="text-lg font-semibold tracking-tight">1.1.8. Charter Manager</h1>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
        <Plane className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">Coming soon</p>
      </div>
    </div>
  )
}
