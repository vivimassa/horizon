/**
 * Convert a 2-letter ISO country code to its flag emoji.
 * Works by mapping each letter to its Regional Indicator Symbol.
 */
export function getCountryFlag(isoCode: string): string {
  if (!isoCode || isoCode.length !== 2) return ''
  const code = isoCode.toUpperCase()
  return String.fromCodePoint(
    0x1f1e6 + code.charCodeAt(0) - 65,
    0x1f1e6 + code.charCodeAt(1) - 65
  )
}
