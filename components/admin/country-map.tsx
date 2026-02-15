'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface CountryMapProps {
  isoCode2: string
  className?: string
}

const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

const geoCache = new Map<string, GeoJSON.FeatureCollection>()

// ─── Helpers ─────────────────────────────────────────────────────────────

function FitBounds({ geoData }: { geoData: GeoJSON.FeatureCollection }) {
  const map = useMap()

  useEffect(() => {
    const layer = L.geoJSON(geoData)
    const bounds = layer.getBounds()
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8, animate: true })
    }
  }, [geoData, map])

  return null
}

function usePrimaryColor() {
  const { resolvedTheme } = useTheme()
  const [color, setColor] = useState('#3b82f6')

  useEffect(() => {
    const style = getComputedStyle(document.documentElement)
    const hsl = style.getPropertyValue('--primary').trim()
    if (hsl) setColor(`hsl(${hsl})`)
  }, [resolvedTheme])

  return color
}

/** Extract all outer rings from GeoJSON + identify the largest by coordinate count */
function extractRings(geoData: GeoJSON.FeatureCollection) {
  const rings: number[][][] = []
  let largest: number[][] = []

  for (const feature of geoData.features) {
    const geom = feature.geometry
    if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0] as number[][]
      rings.push(ring)
      if (ring.length > largest.length) largest = ring
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of geom.coordinates) {
        const ring = poly[0] as number[][]
        rings.push(ring)
        if (ring.length > largest.length) largest = ring
      }
    }
  }

  return { rings, largest }
}

// ─── Glowing Line Animation ─────────────────────────────────────────────
//
// Two SVG layers added directly to Leaflet's SVG renderer:
//   1. Static borders for ALL polygon rings (subtle, semi-transparent)
//   2. Animated glow segment on the LARGEST ring (stroke-dasharray + dashoffset)
//
// The glow segment is ~12% of the border length and moves at a constant
// 80 px/sec regardless of zoom level.

const GLOW_SPEED = 80
const GLOW_FRACTION = 0.12

function GlowingLine({ geoData, color }: { geoData: GeoJSON.FeatureCollection; color: string }) {
  const map = useMap()
  const { rings, largest } = useMemo(() => extractRings(geoData), [geoData])

  useEffect(() => {
    if (largest.length < 3) return

    let cancelled = false
    let animId = 0
    let groupEl: SVGGElement | null = null
    let viewHandler: (() => void) | null = null

    // Defer one frame so the <GeoJSON> component initializes Leaflet's SVG renderer
    const initFrameId = requestAnimationFrame(() => {
      if (cancelled) return

      const svg = map.getContainer().querySelector('svg.leaflet-zoom-animated') as SVGSVGElement | null
      const rootGroup = svg?.querySelector('g') as SVGGElement | null
      if (!svg || !rootGroup) return

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      groupEl = g

      // ── Static border paths for ALL rings ──
      const staticPaths: SVGPathElement[] = rings.map(() => {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('fill', 'none')
        p.setAttribute('stroke', color)
        p.setAttribute('stroke-opacity', '0.2')
        p.setAttribute('stroke-width', '1.5')
        p.setAttribute('stroke-linejoin', 'round')
        g.appendChild(p)
        return p
      })

      // ── Animated glow path for LARGEST ring ──
      const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      glowPath.setAttribute('fill', 'none')
      glowPath.setAttribute('stroke', color)
      glowPath.setAttribute('stroke-width', '2.5')
      glowPath.setAttribute('stroke-linecap', 'round')
      glowPath.setAttribute('stroke-linejoin', 'round')
      glowPath.style.filter = `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
      g.appendChild(glowPath)

      rootGroup.appendChild(g)

      let totalLength = 0
      let progress = 0

      function projectRing(ring: number[][]): string {
        return 'M' + ring.map(([lng, lat]) => {
          const pt = map.latLngToLayerPoint(L.latLng(lat, lng))
          return `${pt.x},${pt.y}`
        }).join('L') + 'Z'
      }

      function buildPaths() {
        // Update all static borders
        rings.forEach((ring, i) => {
          staticPaths[i].setAttribute('d', projectRing(ring))
        })
        // Update glow path
        glowPath.setAttribute('d', projectRing(largest))
        totalLength = glowPath.getTotalLength()
        if (totalLength > 0) {
          const glowLen = totalLength * GLOW_FRACTION
          glowPath.setAttribute('stroke-dasharray', `${glowLen} ${totalLength - glowLen}`)
        }
      }

      buildPaths()

      let lastTime = performance.now()

      function animate(time: number) {
        if (cancelled) return
        const delta = time - lastTime
        lastTime = time

        if (totalLength > 0) {
          // Constant px/sec: larger borders take longer to traverse
          progress = (progress + (delta / 1000) * GLOW_SPEED / totalLength) % 1
          glowPath.setAttribute('stroke-dashoffset', String(-progress * totalLength))
        }

        animId = requestAnimationFrame(animate)
      }

      animId = requestAnimationFrame(animate)

      viewHandler = buildPaths
      map.on('zoomend viewreset', buildPaths)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(initFrameId)
      cancelAnimationFrame(animId)
      if (viewHandler) map.off('zoomend viewreset', viewHandler)
      groupEl?.remove()
    }
  }, [map, rings, largest, color])

  return null
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function CountryMap({ isoCode2, className }: CountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const primaryColor = usePrimaryColor()

  useEffect(() => {
    if (!isoCode2) return

    setGeoData(null)
    setLoading(true)

    if (geoCache.has(isoCode2)) {
      setGeoData(geoCache.get(isoCode2)!)
      setLoading(false)
      return
    }

    const controller = new AbortController()

    fetch(`/data/countries/${isoCode2}.geojson`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        let fc: GeoJSON.FeatureCollection
        if (data.type === 'Feature') {
          fc = { type: 'FeatureCollection', features: [data] }
        } else if (data.type === 'FeatureCollection') {
          fc = data
        } else {
          throw new Error('Unknown GeoJSON type')
        }
        geoCache.set(isoCode2, fc)
        setGeoData(fc)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('Failed to load country borders:', err)
          setGeoData(null)
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [isoCode2])

  // Fill-only style — border strokes are rendered by GlowingLine
  const geoStyle = useMemo(
    () => ({
      color: 'transparent',
      weight: 0,
      fillColor: primaryColor,
      fillOpacity: 0.04,
    }),
    [primaryColor]
  )

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-2xl glass overflow-hidden flex items-center justify-center',
          className
        )}
      >
        <div className="text-muted-foreground text-sm animate-pulse">Loading map...</div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-2xl overflow-hidden glass country-map-container', className)}>
      <MapContainer
        center={[20, 106]}
        zoom={2}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'transparent' }}
      >
        <TileLayer
          key={isDark ? 'dark' : 'light'}
          url={isDark ? DARK_TILES : LIGHT_TILES}
        />
        {geoData && (
          <>
            <GeoJSON key={`${isoCode2}-${primaryColor}`} data={geoData} style={geoStyle} />
            <FitBounds geoData={geoData} />
            <GlowingLine geoData={geoData} color={primaryColor} />
          </>
        )}
      </MapContainer>
    </div>
  )
}
