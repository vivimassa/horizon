import { cn } from '@/lib/utils'
import { type DockPosition } from '@/hooks/use-user-preferences'

interface HorizonLogoProps {
  variant?: 'dock' | 'full'
  dockPosition?: DockPosition
  className?: string
}

/**
 * Horizon logo with compass icon.
 * - "dock" variant: animates between "Horizon" (horizontal) and "H" (vertical)
 * - "full" variant: large logo for login/register pages with compass above
 */
export function HorizonLogo({ variant = 'dock', dockPosition = 'bottom', className }: HorizonLogoProps) {
  if (variant === 'full') {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <img
          src="/horizon-watermark.png"
          alt="Horizon Airline Management System"
          className="h-20 w-auto object-contain"
          draggable={false}
        />
      </div>
    )
  }

  const isVertical = dockPosition === 'left'

  // Dock variant — "H" always visible, "orizon" animates via max-width + opacity
  return (
    <div className={cn('flex items-center gap-0.5 overflow-hidden', className)}>
      {/* Small compass icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="text-primary-foreground shrink-0"
      >
        <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" opacity="0.4" />
        <path d="M24 6 L28 24 L24 20 L20 24 Z" fill="currentColor" opacity="0.8" />
        <path d="M24 42 L28 24 L24 28 L20 24 Z" fill="currentColor" opacity="0.35" />
        <circle cx="24" cy="24" r="2.5" fill="currentColor" opacity="0.6" />
      </svg>
      <span
        className={cn(
          'font-bold text-primary-foreground leading-none whitespace-nowrap transition-all duration-300 ease-in-out overflow-hidden',
          isVertical
            ? 'max-w-0 opacity-0 text-[0px]'
            : 'max-w-[60px] opacity-100 text-[11px] tracking-wider'
        )}
      >
        Horizon
      </span>
    </div>
  )
}
