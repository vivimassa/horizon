'use client'

import { cn } from '@/lib/utils'

interface LiquidGlassToggleProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}

export function LiquidGlassToggle({ checked, onCheckedChange, className }: LiquidGlassToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative w-16 h-8 rounded-full transition-colors duration-300',
        'backdrop-blur-md border',
        checked
          ? 'bg-[#34C759]/80 border-[#34C759]/30 shadow-[0_0_12px_rgba(52,199,89,0.3)_inset]'
          : 'bg-black/10 dark:bg-white/10 border-black/10 dark:border-white/10',
        className
      )}
    >
      {/* Sun icon — left side */}
      <span className={cn(
        'absolute left-1.5 top-1/2 -translate-y-1/2 text-[11px] transition-opacity duration-300',
        checked ? 'opacity-30' : 'opacity-70'
      )}>
        &#9728;
      </span>

      {/* Moon icon — right side */}
      <span className={cn(
        'absolute right-1.5 top-1/2 -translate-y-1/2 text-[11px] transition-opacity duration-300',
        checked ? 'opacity-70' : 'opacity-30'
      )}>
        &#9790;
      </span>

      {/* Knob */}
      <span
        className={cn(
          'absolute top-0.5 left-0.5 w-7 h-7 rounded-full',
          'bg-gradient-to-b from-white to-gray-100',
          'shadow-[0_2px_4px_rgba(0,0,0,0.2),0_0_1px_rgba(0,0,0,0.1)]',
          'transition-transform duration-400',
        )}
        style={{
          transform: checked ? 'translateX(32px)' : 'translateX(0px)',
          transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      />
    </button>
  )
}
