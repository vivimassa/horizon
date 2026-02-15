'use client'

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import Map, { type MapRef } from 'react-map-gl/mapbox'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

const STYLES = {
  light: 'mapbox://styles/mapbox/light-v11',
  dark: 'mapbox://styles/mapbox/dark-v11',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
} as const

export type MapStyle = 'light' | 'dark' | 'satellite'

interface MapboxMapProps {
  /** Initial center [longitude, latitude] */
  center?: [number, number]
  /** Initial zoom level */
  zoom?: number
  /** Force satellite mode as default */
  defaultSatellite?: boolean
  /** Show the satellite/map toggle button */
  showToggle?: boolean
  /** Top-left pill overlay (flags, names, etc.) */
  overlay?: ReactNode
  /** Additional overlays positioned absolutely over the map */
  overlays?: ReactNode
  /** Children rendered inside the Map (Source, Layer, Marker, etc.) */
  children?: ReactNode
  /** Outer container className */
  className?: string
  /** Callback when map instance is ready */
  onMapReady?: (map: mapboxgl.Map) => void
  /** Callback to expose satellite state to parent */
  onStyleChange?: (style: MapStyle) => void
  /** Disable scroll zoom */
  scrollZoom?: boolean
  /** Interactive (pan/zoom) */
  interactive?: boolean
  /** Fit bounds: [[west, south], [east, north]] */
  bounds?: [[number, number], [number, number]]
  /** Padding for fitBounds */
  fitBoundsOptions?: { padding?: number | { top: number; bottom: number; left: number; right: number }; maxZoom?: number }
}

export { MAPBOX_TOKEN, STYLES }
export type { MapboxMapProps, MapRef }

export default function MapboxMap({
  center = [106, 20],
  zoom = 2,
  defaultSatellite = false,
  showToggle = true,
  overlay,
  overlays,
  children,
  className,
  onMapReady,
  onStyleChange,
  scrollZoom = true,
  interactive = true,
  bounds,
  fitBoundsOptions,
}: MapboxMapProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [isSatellite, setIsSatellite] = useState(defaultSatellite)
  const mapRef = useRef<MapRef>(null)

  const mapStyle = isSatellite
    ? STYLES.satellite
    : isDark ? STYLES.dark : STYLES.light

  const handleToggle = useCallback(() => {
    setIsSatellite(prev => {
      const next = !prev
      const style: MapStyle = next ? 'satellite' : isDark ? 'dark' : 'light'
      onStyleChange?.(style)
      return next
    })
  }, [isDark, onStyleChange])

  const handleLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      onMapReady?.(map)
      if (bounds) {
        map.fitBounds(bounds, {
          padding: fitBoundsOptions?.padding ?? 50,
          maxZoom: fitBoundsOptions?.maxZoom ?? 16,
          animate: false,
        })
      }
    }
  }, [onMapReady, bounds, fitBoundsOptions])

  // Re-fit bounds when they change
  useEffect(() => {
    if (!bounds) return
    const map = mapRef.current?.getMap()
    if (map) {
      map.fitBounds(bounds, {
        padding: fitBoundsOptions?.padding ?? 50,
        maxZoom: fitBoundsOptions?.maxZoom ?? 16,
        animate: true,
      })
    }
  }, [bounds, fitBoundsOptions])

  return (
    <div className={cn('relative rounded-2xl overflow-hidden glass', className)}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        attributionControl={false}
        scrollZoom={scrollZoom}
        dragPan={interactive}
        dragRotate={false}
        pitchWithRotate={false}
        touchZoomRotate={interactive}
        doubleClickZoom={interactive}
        onLoad={handleLoad}
      >
        {children}
      </Map>

      {/* Top-left overlay pill */}
      {overlay && (
        <div
          className="absolute top-3 left-3 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
          }}
        >
          {overlay}
        </div>
      )}

      {/* Additional positioned overlays */}
      {overlays}

      {/* Satellite / Map toggle — top right */}
      {showToggle && (
        <button
          onClick={handleToggle}
          className="absolute top-3 right-3 z-[1000] px-3 py-1.5 rounded-full text-xs font-medium text-white transition-colors"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          {isSatellite ? 'Map' : 'Satellite'}
        </button>
      )}
    </div>
  )
}
