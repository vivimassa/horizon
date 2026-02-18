import { GitCompareArrows, Plane } from 'lucide-react'

export default function SSIMComparisonPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <GitCompareArrows className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">1.1.10.3. SSIM Comparison</h2>
            <p className="text-sm text-muted-foreground">Compare SSIM files or schedule versions side-by-side</p>
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
