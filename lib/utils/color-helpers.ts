/**
 * Color utility functions for Gantt chart bar coloring.
 * Pure functions — no side effects.
 */

export interface HSL {
  h: number
  s: number
  l: number
}

/** Parse "#RRGGBB" or "#RGB" to HSL. */
export function hexToHSL(hex: string): HSL {
  let r = 0, g = 0, b = 0
  const h = hex.replace('#', '')
  if (h.length === 3) {
    r = parseInt(h[0] + h[0], 16) / 255
    g = parseInt(h[1] + h[1], 16) / 255
    b = parseInt(h[2] + h[2], 16) / 255
  } else {
    r = parseInt(h.slice(0, 2), 16) / 255
    g = parseInt(h.slice(2, 4), 16) / 255
    b = parseInt(h.slice(4, 6), 16) / 255
  }

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  let hue = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: hue = ((b - r) / d + 2) / 6; break
      case b: hue = ((r - g) / d + 4) / 6; break
    }
  }

  return {
    h: Math.round(hue * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  }
}

/** Convert HSL to "#RRGGBB". */
export function hslToHex(hsl: HSL): string {
  const { h, s, l } = hsl
  const sn = s / 100
  const ln = l / 100

  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ln - c / 2

  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x; b = 0 }
  else if (h < 120) { r = x; g = c; b = 0 }
  else if (h < 180) { r = 0; g = c; b = x }
  else if (h < 240) { r = 0; g = x; b = c }
  else if (h < 300) { r = x; g = 0; b = c }
  else { r = c; g = 0; b = x }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/**
 * Convert a light-mode fill color to its dark-mode equivalent.
 * Desaturates slightly and inverts lightness.
 */
export function lightToDark(lightHex: string): string {
  const hsl = hexToHSL(lightHex)
  return hslToHex({
    h: hsl.h,
    s: Math.max(Math.round(hsl.s * 0.75), 10),
    l: clamp(Math.round(100 - hsl.l * 0.85), 12, 28),
  })
}

/**
 * Compute readable text color for a bar background.
 * For vivid / dark backgrounds (lightness ≤ 55%), use light text.
 * For pale / light backgrounds, use dark saturated text.
 */
export function getBarTextColor(bgHex: string, isDark: boolean): string {
  const hsl = hexToHSL(bgHex)
  // Vivid / medium-dark fill (e.g. blue-500 at L≈60): needs white/light text
  if (hsl.l <= 65 && hsl.s > 30) {
    return isDark
      ? hslToHex({ h: hsl.h, s: Math.min(hsl.s, 30), l: 92 })
      : '#ffffff'
  }
  if (isDark) {
    return hslToHex({ h: hsl.h, s: Math.min(hsl.s, 40), l: 80 })
  }
  return hslToHex({ h: hsl.h, s: Math.min(hsl.s + 20, 80), l: 25 })
}

/** Default color settings for bar fills. */
export const DEFAULT_BAR_COLORS = {
  unassigned: '#DBEAFE', // blue-100 (pale)
  assigned: '#3B82F6',   // blue-500 (strong)
}
