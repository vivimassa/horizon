'use client'

import { useMemo } from 'react'
import { Marker } from 'react-map-gl/mapbox'
import MapboxMap from '@/components/ui/mapbox-map'
import { cn } from '@/lib/utils'

interface AirportMapProps {
  latitude: number
  longitude: number
  name: string
  isoCode2?: string | null
  flagEmoji?: string | null
  className?: string
}

export default function AirportMap({ latitude, longitude, name, isoCode2, className }: AirportMapProps) {
  const overlay = useMemo(() => (
    <>
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
    </>
  ), [isoCode2, name])

  return (
    <MapboxMap
      center={[longitude, latitude]}
      zoom={14}
      defaultSatellite={false}
      className={cn('h-full', className)}
      overlay={overlay}
    >
      <Marker longitude={longitude} latitude={latitude} anchor="center">
        <div
          style={{
            width: 24,
            height: 24,
            background: 'hsl(var(--primary))',
            border: '3px solid white',
            borderRadius: '50%',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        />
      </Marker>
    </MapboxMap>
  )
}
