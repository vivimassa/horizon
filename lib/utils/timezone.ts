/**
 * Timezone utility functions using date-fns-tz.
 * All runtime DST conversions use IANA timezone strings.
 */
import { toZonedTime, fromZonedTime, format } from 'date-fns-tz'

/** Convert a local time in a given timezone to UTC */
export function toUTC(localTime: Date, ianaTimezone: string): Date {
  return fromZonedTime(localTime, ianaTimezone)
}

/** Convert a UTC time to a local time in a given timezone */
export function toLocal(utcTime: Date, ianaTimezone: string): Date {
  return toZonedTime(utcTime, ianaTimezone)
}

/** Get the current UTC offset string for a timezone (e.g. "+07:00", "-05:00") */
export function getUTCOffset(ianaTimezone: string, atDate?: Date): string {
  const date = atDate ?? new Date()
  return format(toZonedTime(date, ianaTimezone), 'xxx', { timeZone: ianaTimezone })
}

/** Check if DST is currently active for a timezone */
export function isDSTActive(ianaTimezone: string, atDate?: Date): boolean {
  const date = atDate ?? new Date()
  // Compare January and July offsets
  const jan = new Date(date.getFullYear(), 0, 15)
  const jul = new Date(date.getFullYear(), 6, 15)
  const janOffset = format(toZonedTime(jan, ianaTimezone), 'xxx', { timeZone: ianaTimezone })
  const julOffset = format(toZonedTime(jul, ianaTimezone), 'xxx', { timeZone: ianaTimezone })

  if (janOffset === julOffset) return false // no DST for this timezone

  const currentOffset = format(toZonedTime(date, ianaTimezone), 'xxx', { timeZone: ianaTimezone })
  // DST is active when the current offset differs from the "standard" (winter) offset
  // In northern hemisphere, standard = January; in southern, standard = July
  // We detect by checking which offset is "more negative" (standard time)
  const janMinutes = offsetToMinutes(janOffset)
  const julMinutes = offsetToMinutes(julOffset)
  const standardOffset = janMinutes < julMinutes ? janOffset : julOffset
  return currentOffset !== standardOffset
}

/** Get the timezone abbreviation (e.g. "ICT", "EST", "EDT") */
export function getTimezoneAbbreviation(ianaTimezone: string, atDate?: Date): string {
  const date = atDate ?? new Date()
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimezone,
      timeZoneName: 'short',
    }).formatToParts(date)
    const tzPart = parts.find(p => p.type === 'timeZoneName')
    return tzPart?.value ?? ianaTimezone
  } catch {
    return ianaTimezone
  }
}

/** Check if a timezone observes DST at all (compares Jan vs Jul offsets) */
export function observesDST(ianaTimezone: string): boolean {
  const year = new Date().getFullYear()
  const jan = new Date(year, 0, 15)
  const jul = new Date(year, 6, 15)
  const janOffset = format(toZonedTime(jan, ianaTimezone), 'xxx', { timeZone: ianaTimezone })
  const julOffset = format(toZonedTime(jul, ianaTimezone), 'xxx', { timeZone: ianaTimezone })
  return janOffset !== julOffset
}

function offsetToMinutes(offset: string): number {
  const match = offset.match(/^([+-])(\d{2}):(\d{2})$/)
  if (!match) return 0
  const sign = match[1] === '+' ? 1 : -1
  return sign * (parseInt(match[2]) * 60 + parseInt(match[3]))
}
