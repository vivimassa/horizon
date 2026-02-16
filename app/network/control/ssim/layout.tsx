import { SsimSubNav } from './ssim-sub-nav'

export default function SSIMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0">
        <SsimSubNav />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-4 pb-8">
        {children}
      </div>
    </div>
  )
}
