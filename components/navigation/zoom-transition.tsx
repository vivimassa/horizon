'use client'

import { usePathname } from 'next/navigation'
import { useRef, useEffect, useState } from 'react'

export function ZoomTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const [animClass, setAnimClass] = useState('animate-zoom-in')

  useEffect(() => {
    const prev = prevPathname.current
    if (prev === pathname) return

    const isDeeper = pathname.split('/').length > prev.split('/').length
    setAnimClass(isDeeper ? 'animate-zoom-in' : 'animate-zoom-out')
    prevPathname.current = pathname
  }, [pathname])

  return (
    <div
      key={pathname}
      className={`${animClass} will-change-[transform,opacity] h-full`}
      style={{ transformOrigin: 'center center' }}
    >
      {children}
    </div>
  )
}
