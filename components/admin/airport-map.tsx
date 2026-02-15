'use client'

import { useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

interface AirportMapProps {
  latitude: number
  longitude: number
  name: string
  isoCode2?: string | null
  flagEmoji?: string | null
  className?: string
}

const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const LIGHT_TILES = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'

// Custom airport marker icon
const airportIcon = new L.DivIcon({
  html: `<div style="
    width: 24px; height: 24px;
    background: hsl(var(--primary));
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
})

function SetView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  map.setView([lat, lng], 14, { animate: true })
  return null
}

export default function AirportMap({ latitude, longitude, name, isoCode2, flagEmoji, className }: AirportMapProps) {
  const [isSatellite, setIsSatellite] = useState(true)
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const tileUrl = isSatellite
    ? SATELLITE_TILES
    : isDark ? DARK_TILES : LIGHT_TILES

  return (
    <div className={cn('rounded-2xl overflow-hidden glass relative', className)}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={14}
        className="h-full w-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: 'transparent' }}
      >
        <TileLayer key={`${isSatellite}-${isDark}`} url={tileUrl} />
        <Marker position={[latitude, longitude]} icon={airportIcon} />
        <SetView lat={latitude} lng={longitude} />
      </MapContainer>

      {/* Flag + Airport name pill — top left */}
      <div
        className="absolute top-3 left-3 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-full"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        }}
      >
        {isoCode2 && (
          <img
            src={`https://flagsapi.com/${isoCode2}/shiny/64.png`}
            alt="flag"
            width={24}
            height={24}
            className="shrink-0 drop-shadow-md"
            loading="lazy"
          />
        )}
        <span className="text-white font-semibold text-xs truncate max-w-[200px]">
          {name}
        </span>
      </div>

      {/* Satellite / Map toggle — top right */}
      <button
        onClick={() => setIsSatellite(!isSatellite)}
        className="absolute top-3 right-3 z-[1000] px-3 py-1.5 rounded-full text-xs font-medium text-white transition-colors"
        style={{
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {isSatellite ? 'Map' : 'Satellite'}
      </button>
    </div>
  )
}
