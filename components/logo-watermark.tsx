'use client'

import { usePathname } from 'next/navigation'

export function LogoWatermark() {
  const pathname = usePathname()

  // Don't render on auth/login pages
  if (pathname === '/login' || pathname?.startsWith('/auth')) {
    return null
  }

  return (
    <div className="fixed inset-0 pointer-events-none select-none -z-[5] overflow-hidden">
      {/* Light mode: subtle noise texture for ceramic surface feel */}
      <div
        className="fixed inset-0 pointer-events-none dark:hidden"
        style={{
          opacity: 0.015,
          mixBlendMode: 'multiply' as const,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Dark mode: accent-colored glow behind logo */}
      <div
        className="hidden dark:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[60px]"
        style={{
          background: `radial-gradient(ellipse, hsl(var(--primary) / 0.05) 0%, hsl(var(--primary) / 0.02) 30%, transparent 65%)`,
        }}
      />

      {/* Logo watermark */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%]">
        {/* Light mode: sculpted ceramic / debossed effect */}
        <img
          src="/horizon-watermark.png"
          alt=""
          aria-hidden="true"
          className="dark:hidden w-[clamp(300px,35vw,550px)] h-auto select-none"
          style={{
            filter: 'grayscale(1) brightness(0) drop-shadow(0 1px 0 rgba(255,255,255,0.8))',
            opacity: 0.035,
            mixBlendMode: 'multiply' as const,
          }}
          draggable={false}
        />

        {/* Dark mode: accent-tinted logo via CSS mask */}
        <div
          className="hidden dark:block w-[clamp(300px,35vw,550px)] h-[clamp(300px,35vw,550px)] opacity-[0.07]"
          style={{
            background: 'hsl(var(--primary))',
            maskImage: "url('/horizon-watermark.png')",
            maskSize: 'contain',
            maskRepeat: 'no-repeat',
            maskPosition: 'center',
            WebkitMaskImage: "url('/horizon-watermark.png')",
            WebkitMaskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
          }}
        />
      </div>
    </div>
  )
}
