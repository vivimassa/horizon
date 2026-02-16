/**
 * Geographic utility functions for great circle distance calculations
 * and route type determination.
 */

import { classifyRoute } from '@/lib/data/airport-countries'

const EARTH_RADIUS_NM = 3440.065 // Earth radius in nautical miles

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Calculate the great circle distance between two points using the Haversine formula.
 * @returns Distance in nautical miles
 */
export function calculateGreatCircleDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(EARTH_RADIUS_NM * c * 10) / 10
}

/**
 * Calculate intermediate points along a great circle path for drawing arcs on a map.
 * Point count scales with distance for smooth curves:
 *   < 500 NM → 50 points, 500-2000 NM → 100 points, > 2000 NM → 200 points
 * @returns Array of [latitude, longitude] points
 */
export function calculateGreatCirclePoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  numPoints?: number
): [number, number][] {
  // Auto-scale point count based on distance if not specified
  if (numPoints == null) {
    const dist = calculateGreatCircleDistance(lat1, lon1, lat2, lon2)
    numPoints = dist > 2000 ? 200 : dist > 500 ? 100 : 50
  }
  const lat1Rad = toRad(lat1)
  const lon1Rad = toRad(lon1)
  const lat2Rad = toRad(lat2)
  const lon2Rad = toRad(lon2)

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat1Rad - lat2Rad) / 2) ** 2 +
          Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin((lon1Rad - lon2Rad) / 2) ** 2
      )
    )

  if (d === 0) return [[lat1, lon1]]

  const points: [number, number][] = []
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints
    const A = Math.sin((1 - f) * d) / Math.sin(d)
    const B = Math.sin(f * d) / Math.sin(d)
    const x = A * Math.cos(lat1Rad) * Math.cos(lon1Rad) + B * Math.cos(lat2Rad) * Math.cos(lon2Rad)
    const y = A * Math.cos(lat1Rad) * Math.sin(lon1Rad) + B * Math.cos(lat2Rad) * Math.sin(lon2Rad)
    const z = A * Math.sin(lat1Rad) + B * Math.sin(lat2Rad)
    const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * (180 / Math.PI)
    const lon = Math.atan2(y, x) * (180 / Math.PI)
    points.push([lat, lon])
  }
  return points
}

/**
 * Determine route type by comparing country and region information.
 * Uses country_id UUIDs first, falls back to IATA lookup if either is NULL.
 * @returns 'domestic' | 'regional' | 'international' | 'unknown'
 */
export function determineRouteType(
  country1Id: string | null,
  country2Id: string | null,
  region1?: string | null,
  region2?: string | null,
  iata1?: string | null,
  iata2?: string | null
): 'domestic' | 'regional' | 'international' | 'unknown' {
  // Primary: compare country UUIDs
  if (country1Id && country2Id) {
    if (country1Id === country2Id) return 'domestic'
    if (region1 && region2 && region1 === region2) return 'regional'
    return 'international'
  }

  // Fallback: use IATA hardcoded lookup when country_id is missing
  if (iata1 && iata2) {
    const result = classifyRoute(iata1, iata2)
    if (result !== 'unknown') return result
  }

  return 'unknown'
}
