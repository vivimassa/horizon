'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Marker } from 'react-map-gl/mapbox'
import MapboxMap from '@/components/ui/mapbox-map'
import { cn } from '@/lib/utils'
import { calculateGreatCirclePoints } from '@/lib/utils/geo'
import type mapboxgl from 'mapbox-gl'

interface CityPairMapProps {
  lat1: number
  lon1: number
  lat2: number
  lon2: number
  iata1: string
  iata2: string
  name1: string
  name2: string
  distanceNm: number | null
  country1Flag?: string | null
  country2Flag?: string | null
  country1Name?: string | null
  country2Name?: string | null
  className?: string
}

// ─── Ping-Pong Glowing Route Animation ──────────────────────────────────
// SVG overlay on top of Mapbox map:
//   1. Static route line (subtle, semi-transparent)
//   2. Single animated glow segment that ping-pongs: A → B, pause, B → A, pause, repeat

const GLOW_SPEED = 80
const GLOW_FRACTION = 0.12
const PAUSE_MS = 250

function PingPongGlowOverlay({
  points,
  mapInstance,
}: {
  points: [number, number][]
  mapInstance: mapboxgl.Map | null
}) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!mapInstance || !svgRef.current || points.length < 2) return

    const svg = svgRef.current
    let cancelled = false
    let animId = 0

    // Clear previous content
    while (svg.firstChild) svg.removeChild(svg.firstChild)

    const primaryColor = getComputedStyle(document.documentElement)
      .getPropertyValue('--primary').trim()
    const color = primaryColor ? `hsl(${primaryColor})` : '#3b82f6'

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

    // Static route path (subtle)
    const staticPath = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    staticPath.setAttribute('fill', 'none')
    staticPath.setAttribute('stroke', color)
    staticPath.setAttribute('stroke-opacity', '0.2')
    staticPath.setAttribute('stroke-width', '1.5')
    staticPath.setAttribute('stroke-linejoin', 'round')
    g.appendChild(staticPath)

    // Single glow path
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
    let glowLen = 0

    function buildPath() {
      const d = 'M' + points.map(([lat, lng]) => {
        const pt = mapInstance!.project([lng, lat])
        return `${pt.x},${pt.y}`
      }).join('L')

      staticPath.setAttribute('d', d)
      glowPath.setAttribute('d', d)

      totalLength = glowPath.getTotalLength()
      if (totalLength > 0) {
        glowLen = totalLength * GLOW_FRACTION
        glowPath.setAttribute('stroke-dasharray', `${glowLen} ${totalLength - glowLen}`)
      }
    }

    buildPath()

    // Animation state
    let phase: 'fwd' | 'pause-b' | 'rev' | 'pause-a' = 'fwd'
    let progress = 0
    let pauseRemaining = 0
    let lastTime = performance.now()

    function animate(time: number) {
      if (cancelled) return
      const delta = time - lastTime
      lastTime = time

      if (totalLength <= 0) {
        animId = requestAnimationFrame(animate)
        return
      }

      if (phase === 'pause-b' || phase === 'pause-a') {
        pauseRemaining -= delta
        if (pauseRemaining <= 0) {
          if (phase === 'pause-b') {
            phase = 'rev'
            progress = 0
          } else {
            phase = 'fwd'
            progress = 0
          }
        }
      } else {
        const step = (delta / 1000) * GLOW_SPEED / totalLength
        progress = Math.min(progress + step, 1)

        if (phase === 'fwd') {
          glowPath.setAttribute('stroke-dashoffset', String(-progress * totalLength))
        } else {
          glowPath.setAttribute('stroke-dashoffset', String(-(1 - progress) * totalLength))
        }

        if (progress >= 1) {
          if (phase === 'fwd') {
            phase = 'pause-b'
            pauseRemaining = PAUSE_MS
          } else {
            phase = 'pause-a'
            pauseRemaining = PAUSE_MS
          }
        }
      }

      animId = requestAnimationFrame(animate)
    }

    animId = requestAnimationFrame(animate)

    // Rebuild on map move/zoom
    const handler = () => buildPath()
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
  }, [mapInstance, points])

  return (
    <svg
      ref={svgRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[500]"
      style={{ overflow: 'visible' }}
    />
  )
}

// ─── Airport Marker ──────────────────────────────────────────────────────

function AirportPin({ iata }: { iata: string }) {
  return (
    <div className="flex flex-col items-center">
      <div
        style={{
          width: 20,
          height: 20,
          background: 'hsl(var(--primary))',
          border: '3px solid white',
          borderRadius: '50%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      />
      <span
        className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white mt-1"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      >
        {iata}
      </span>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────

export default function CityPairMap({
  lat1, lon1, lat2, lon2,
  iata1, iata2,
  distanceNm,
  country1Flag, country2Flag, country1Name, country2Name,
  className,
}: CityPairMapProps) {
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null)

  const gcPoints = useMemo(
    () => calculateGreatCirclePoints(lat1, lon1, lat2, lon2),
    [lat1, lon1, lat2, lon2]
  )

  const midIdx = Math.floor(gcPoints.length / 2)
  const midPoint = gcPoints[midIdx]

  const countryLabel = country1Name === country2Name
    ? country1Name || ''
    : `${country1Name || '?'} — ${country2Name || '?'}`

  // Bounds: [[west, south], [east, north]]
  const bounds = useMemo<[[number, number], [number, number]]>(() => {
    const west = Math.min(lon1, lon2)
    const east = Math.max(lon1, lon2)
    const south = Math.min(lat1, lat2)
    const north = Math.max(lat1, lat2)
    return [[west, south], [east, north]]
  }, [lat1, lon1, lat2, lon2])

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map)
  }, [])

  const overlay = useMemo(() => (
    <>
      {country1Flag && (
        <img
          src={`https://flagsapi.com/${country1Flag}/shiny/64.png`}
          alt=""
          width={20}
          height={20}
          className="shrink-0 drop-shadow-md"
          loading="lazy"
        />
      )}
      {country2Flag && country2Flag !== country1Flag && (
        <img
          src={`https://flagsapi.com/${country2Flag}/shiny/64.png`}
          alt=""
          width={20}
          height={20}
          className="shrink-0 drop-shadow-md"
          loading="lazy"
        />
      )}
      <span className="text-white font-semibold text-xs truncate max-w-[200px]">
        {countryLabel}
      </span>
    </>
  ), [country1Flag, country2Flag, countryLabel])

  return (
    <MapboxMap
      center={[(lon1 + lon2) / 2, (lat1 + lat2) / 2]}
      zoom={5}
      className={cn('h-full', className)}
      onMapReady={handleMapReady}
      overlay={overlay}
      bounds={bounds}
      fitBoundsOptions={{ padding: 50, maxZoom: 8 }}
      overlays={
        mapInstance ? (
          <PingPongGlowOverlay points={gcPoints} mapInstance={mapInstance} />
        ) : null
      }
    >
      {/* Airport markers */}
      <Marker longitude={lon1} latitude={lat1} anchor="center">
        <AirportPin iata={iata1} />
      </Marker>
      <Marker longitude={lon2} latitude={lat2} anchor="center">
        <AirportPin iata={iata2} />
      </Marker>

      {/* Distance label at midpoint */}
      {distanceNm && (
        <Marker longitude={midPoint[1]} latitude={midPoint[0]} anchor="center">
          <div
            style={{
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(4px)',
              color: 'white',
              padding: '2px 10px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {distanceNm} NM
          </div>
        </Marker>
      )}
    </MapboxMap>
  )
}
