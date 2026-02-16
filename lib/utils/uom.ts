// ─── Unit of Measure Types ──────────────────────────────────────────
export type WeightUnit = 'kg' | 'lbs'
export type DistanceUnit = 'nm' | 'km' | 'mi'
export type SpeedUnit = 'kts' | 'km/h' | 'mph'
export type LengthUnit = 'm' | 'ft'
export type TemperatureUnit = 'c' | 'f'
export type FuelVolumeUnit = 'usg' | 'l' | 'ig'
export type VolumeUnit = 'm3' | 'ft3'

// ─── Conversion Factors ────────────────────────────────────────────
const KG_TO_LBS = 2.20462
const NM_TO_KM = 1.852
const NM_TO_MI = 1.15078
const M_TO_FT = 3.28084
const KTS_TO_KMH = 1.852
const KTS_TO_MPH = 1.15078
const M3_TO_FT3 = 35.3147

const KG_PER_USG = (sg: number) => sg * 3.7854
const KG_PER_IG = (sg: number) => sg * 4.546
const KG_PER_L = (sg: number) => sg

// ─── Unit Labels ───────────────────────────────────────────────────
export const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  lbs: 'lbs',
  nm: 'NM',
  km: 'km',
  mi: 'mi',
  kts: 'kts',
  'km/h': 'km/h',
  mph: 'mph',
  m: 'm',
  ft: 'ft',
  c: '\u00B0C',
  f: '\u00B0F',
  usg: 'USG',
  l: 'L',
  ig: 'IG',
  m3: 'm\u00B3',
  ft3: 'ft\u00B3',
}

// ─── Display Formatters (stored value -> display string) ───────────

/** Format weight (stored in kg) */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg == null) return '\u2014'
  const val = unit === 'lbs' ? kg * KG_TO_LBS : kg
  return `${Math.round(val).toLocaleString()} ${UNIT_LABELS[unit]}`
}

/** Format distance (stored in NM) */
export function formatDistance(nm: number | null | undefined, unit: DistanceUnit): string {
  if (nm == null) return '\u2014'
  let val: number
  switch (unit) {
    case 'km': val = nm * NM_TO_KM; break
    case 'mi': val = nm * NM_TO_MI; break
    default: val = nm
  }
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit]}`
}

/** Format speed (stored in knots) */
export function formatSpeed(kts: number | null | undefined, unit: SpeedUnit): string {
  if (kts == null) return '\u2014'
  let val: number
  switch (unit) {
    case 'km/h': val = kts * KTS_TO_KMH; break
    case 'mph': val = kts * KTS_TO_MPH; break
    default: val = kts
  }
  return `${Math.round(val).toLocaleString()} ${UNIT_LABELS[unit]}`
}

/** Format length/runway (stored in meters) */
export function formatLength(m: number | null | undefined, unit: LengthUnit): string {
  if (m == null) return '\u2014'
  const val = unit === 'ft' ? m * M_TO_FT : m
  return `${Math.round(val).toLocaleString()} ${UNIT_LABELS[unit]}`
}

/** Format elevation (stored in feet) */
export function formatElevation(ft: number | null | undefined, unit: LengthUnit): string {
  if (ft == null) return '\u2014'
  const val = unit === 'm' ? ft / M_TO_FT : ft
  return `${Math.round(val).toLocaleString()} ${UNIT_LABELS[unit]}`
}

/** Format temperature (stored in Celsius) */
export function formatTemperature(c: number | null | undefined, unit: TemperatureUnit): string {
  if (c == null) return '\u2014'
  const val = unit === 'f' ? (c * 9) / 5 + 32 : c
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit]}`
}

/** Format fuel volume (stored in kg, converted via specific gravity) */
export function formatFuelVolume(
  kg: number | null | undefined,
  unit: FuelVolumeUnit,
  specificGravity: number = 0.80
): string {
  if (kg == null) return '\u2014'
  let val: number
  switch (unit) {
    case 'usg': val = kg / KG_PER_USG(specificGravity); break
    case 'ig': val = kg / KG_PER_IG(specificGravity); break
    case 'l': val = kg / KG_PER_L(specificGravity); break
    default: val = kg
  }
  return `${Math.round(val).toLocaleString()} ${UNIT_LABELS[unit]}`
}

/** Format cargo volume (stored in m3) */
export function formatVolume(m3: number | null | undefined, unit: VolumeUnit): string {
  if (m3 == null) return '\u2014'
  const val = unit === 'ft3' ? m3 * M3_TO_FT3 : m3
  return `${val.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit]}`
}

// ─── Input Parsers (user input -> stored value) ────────────────────

/** Parse weight input to kg */
export function parseWeight(value: number, unit: WeightUnit): number {
  return unit === 'lbs' ? value / KG_TO_LBS : value
}

/** Parse distance input to NM */
export function parseDistance(value: number, unit: DistanceUnit): number {
  switch (unit) {
    case 'km': return value / NM_TO_KM
    case 'mi': return value / NM_TO_MI
    default: return value
  }
}

/** Parse length input to meters */
export function parseLength(value: number, unit: LengthUnit): number {
  return unit === 'ft' ? value / M_TO_FT : value
}

/** Parse speed input to knots */
export function parseSpeed(value: number, unit: SpeedUnit): number {
  switch (unit) {
    case 'km/h': return value / KTS_TO_KMH
    case 'mph': return value / KTS_TO_MPH
    default: return value
  }
}

/** Parse temperature input to Celsius */
export function parseTemperature(value: number, unit: TemperatureUnit): number {
  return unit === 'f' ? ((value - 32) * 5) / 9 : value
}

/** Parse fuel volume input to kg */
export function parseFuelVolume(
  value: number,
  unit: FuelVolumeUnit,
  specificGravity: number = 0.80
): number {
  switch (unit) {
    case 'usg': return value * KG_PER_USG(specificGravity)
    case 'ig': return value * KG_PER_IG(specificGravity)
    case 'l': return value * KG_PER_L(specificGravity)
    default: return value
  }
}

/** Parse volume input to m3 */
export function parseVolume(value: number, unit: VolumeUnit): number {
  return unit === 'ft3' ? value / M3_TO_FT3 : value
}
