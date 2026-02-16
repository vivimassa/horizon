import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convert minutes to HH:MM display (e.g. 70 → "01:10") */
export function minutesToHHMM(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Convert HH:MM string to minutes (e.g. "01:10" → 70). Also handles raw numbers like "55" → 55 */
export function hhmmToMinutes(hhmm: string): number | null {
  if (!hhmm || !hhmm.trim()) return null
  const trimmed = hhmm.trim()
  if (trimmed.includes(':')) {
    const [h, m] = trimmed.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    return h * 60 + m
  }
  const n = Number(trimmed)
  return isNaN(n) ? null : n
}
