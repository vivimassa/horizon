'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { Source, Layer } from 'react-map-gl/mapbox'
import MapboxMap from '@/components/ui/mapbox-map'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import type mapboxgl from 'mapbox-gl'

interface CountryMapProps {
  isoCode2: string
  className?: string
}

const geoCache = new Map<string, GeoJSON.FeatureCollection>()

// ─── Helpers ─────────────────────────────────────────────────────────────

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
      const ring = (geom as GeoJSON.Polygon).coordinates[0] as number[][]
      rings.push(ring)
      if (ring.length > largest.length) largest = ring
    } else if (geom.type === 'MultiPolygon') {
      for (const poly of (geom as GeoJSON.MultiPolygon).coordinates) {
        const ring = poly[0] as number[][]
        rings.push(ring)
        if (ring.length > largest.length) largest = ring
      }
    }
  }

  return { rings, largest }
}

// ─── Glowing Border Animation ────────────────────────────────────────────
// Uses an SVG overlay on top of the Mapbox map to render:
//   1. Static borders for all polygon rings (subtle, semi-transparent)
//   2. Animated glow segment on the largest ring

const GLOW_SPEED = 80
const GLOW_FRACTION = 0.12

function GlowOverlay({
  geoData,
  color,
  mapInstance,
}: {
  geoData: GeoJSON.FeatureCollection
  color: string
  mapInstance: mapboxgl.Map | null
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const { rings, largest } = useMemo(() => extractRings(geoData), [geoData])

  useEffect(() => {
    if (!mapInstance || !svgRef.current || largest.length < 3) return

    const svg = svgRef.current
    let cancelled = false
    let animId = 0

    // Clear previous content
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

    // Static border paths for ALL rings
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

    // Animated glow path for LARGEST ring
    const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    glowPath.setAttribute('fill', 'none')
    glowPath.setAttribute('stroke', color)
    glowPath.setAttribute('stroke-width', '2.5')
    glowPath.setAttribute('stroke-linecap', 'round')
    glowPath.setAttribute('stroke-linejoin', 'round')
    glowPath.style.filter = `drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px ${color})`
    g.appendChild(glowPath)

    svg.appendChild(g)

    let totalLength = 0
    let progress = 0

    function projectRing(ring: number[][]): string {
      return 'M' + ring.map(([lng, lat]) => {
        const pt = mapInstance!.project([lng, lat])
        return `${pt.x},${pt.y}`
      }).join('L') + 'Z'
    }

    function buildPaths() {
      rings.forEach((ring, i) => {
        staticPaths[i].setAttribute('d', projectRing(ring))
      })
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
        progress = (progress + (delta / 1000) * GLOW_SPEED / totalLength) % 1
        glowPath.setAttribute('stroke-dashoffset', String(-progress * totalLength))
      }

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)

    // Rebuild on map move/zoom
    const handler = () => buildPaths()
    mapInstance.on('move', handler)
    mapInstance.on('zoom', handler)
    mapInstance.on('resize', handler)

    return () => {
      cancelled = true
      cancelAnimationFrame(animId)
      mapInstance.off('move', handler)
      mapInstance.off('zoom', handler)
      mapInstance.off('resize', handler)
      while (svg.firstChild) svg.removeChild(svg.firstChild)
    }
  }, [mapInstance, rings, largest, color])

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[500]"
      style={{ overflow: 'visible' }}
    />
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function CountryMap({ isoCode2, className }: CountryMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)
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

  // Fit bounds to GeoJSON when map is ready and geoData loads
  useEffect(() => {
    if (!mapInstance || !geoData) return

    // Calculate bounding box from GeoJSON features
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
    for (const feature of geoData.features) {
      const geom = feature.geometry
      const coords: number[][][] = geom.type === 'Polygon'
        ? (geom as GeoJSON.Polygon).coordinates
        : geom.type === 'MultiPolygon'
          ? (geom as GeoJSON.MultiPolygon).coordinates.flat()
          : []
      for (const ring of coords) {
        for (const [lng, lat] of ring) {
          if (lng < minLng) minLng = lng
          if (lng > maxLng) maxLng = lng
          if (lat < minLat) minLat = lat
          if (lat > maxLat) maxLat = lat
        }
      }
    }

    if (minLng < Infinity) {
      mapInstance.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 30, maxZoom: 8, animate: true }
      )
    }
  }, [mapInstance, geoData])

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map)
  }, [])

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
    <MapboxMap
      center={[106, 20]}
      zoom={2}
      className={cn('h-full', className)}
      onMapReady={handleMapReady}
      showToggle={true}
      overlays={
        mapInstance && geoData ? (
          <GlowOverlay geoData={geoData} color={primaryColor} mapInstance={mapInstance} />
        ) : null
      }
    >
      {geoData && (
        <Source id="country-fill" type="geojson" data={geoData}>
          <Layer
            id="country-fill-layer"
            type="fill"
            paint={{
              'fill-color': primaryColor,
              'fill-opacity': 0.04,
            }}
          />
        </Source>
      )}
    </MapboxMap>
  )
}
