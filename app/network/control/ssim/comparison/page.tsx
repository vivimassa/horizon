import { GitCompareArrows } from 'lucide-react'

export default function SSIMComparisonPage() {
  return (
    <div className="glass rounded-2xl p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <GitCompareArrows className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Schedule Comparison</h2>
      <p className="text-muted-foreground max-w-md mx-auto">
        Compare two SSIM files or schedule versions side-by-side to identify differences
        in flights, routes, and timings. Coming soon.
      </p>
    </div>
  )
}
