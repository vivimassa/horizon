'use client'

import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useBreakpoint } from '@/hooks/use-breakpoint'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface TabItem {
  value: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
}

interface ResponsiveTabBarProps {
  tabs: TabItem[]
  value: string
  onValueChange: (value: string) => void
  className?: string
}

export function ResponsiveTabBar({
  tabs,
  value,
  onValueChange,
  className,
}: ResponsiveTabBarProps) {
  const breakpoint = useBreakpoint()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Track scroll position for tablet fade indicators
  useEffect(() => {
    if (breakpoint !== 'tablet') return
    const el = scrollRef.current
    if (!el) return

    const updateScroll = () => {
      setCanScrollLeft(el.scrollLeft > 0)
      setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
    }

    updateScroll()
    el.addEventListener('scroll', updateScroll, { passive: true })
    const resizeObserver = new ResizeObserver(updateScroll)
    resizeObserver.observe(el)

    return () => {
      el.removeEventListener('scroll', updateScroll)
      resizeObserver.disconnect()
    }
  }, [breakpoint])

  // Mobile: Select dropdown
  if (breakpoint === 'mobile') {
    const selectedTab = tabs.find((t) => t.value === value)
    const Icon = selectedTab?.icon

    return (
      <div className={cn('w-full', className)}>
        <Select value={value} onValueChange={onValueChange}>
          <SelectTrigger className="w-full glass rounded-xl min-h-[44px]">
            <SelectValue>
              <span className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4" />}
                {selectedTab?.label}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="glass-heavy">
            {tabs.map((tab) => {
              const TabIcon = tab.icon
              return (
                <SelectItem key={tab.value} value={tab.value} className="min-h-[44px]">
                  <span className="flex items-center gap-2">
                    {TabIcon && <TabIcon className="h-4 w-4" />}
                    {tab.label}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>
    )
  }

  // Tablet: Scrollable tabs
  if (breakpoint === 'tablet') {
    return (
      <div className={cn('relative', className)}>
        {/* Left fade */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/80 to-transparent z-10 pointer-events-none rounded-l-lg" />
        )}

        <div
          ref={scrollRef}
          className="overflow-x-auto scrollbar-thin"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <Tabs value={value} onValueChange={onValueChange}>
            <TabsList className="glass w-max">
              {tabs.map((tab) => {
                const TabIcon = tab.icon
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="min-h-[44px] whitespace-nowrap"
                  >
                    <span className="flex items-center gap-2">
                      {TabIcon && <TabIcon className="h-4 w-4" />}
                      {tab.label}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        </div>

        {/* Right fade */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/80 to-transparent z-10 pointer-events-none rounded-r-lg" />
        )}
      </div>
    )
  }

  // Desktop: Standard tabs
  return (
    <div className={className}>
      <Tabs value={value} onValueChange={onValueChange}>
        <TabsList className="glass">
          {tabs.map((tab) => {
            const TabIcon = tab.icon
            return (
              <TabsTrigger key={tab.value} value={tab.value}>
                <span className="flex items-center gap-2">
                  {TabIcon && <TabIcon className="h-4 w-4" />}
                  {tab.label}
                </span>
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
    </div>
  )
}
