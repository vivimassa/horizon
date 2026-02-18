import dynamic from 'next/dynamic'
import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAllAircraftSeatingConfigs } from '@/app/actions/aircraft-registrations'
import { getAirports } from '@/app/actions/airports'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'

const MovementControl = dynamic(
  () => import('@/components/operations/movement-control').then(mod => mod.MovementControl),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <span className="text-[13px] text-muted-foreground animate-pulse">Loading Movement Control...</span>
      </div>
    ),
  }
)

export default async function MovementControlPage() {
  const [registrations, aircraftTypes, seatingConfigs, airports, serviceTypes] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
    getAllAircraftSeatingConfigs(),
    getAirports(),
    getFlightServiceTypes(),
  ])

  return (
    <MovementControl
      registrations={registrations}
      aircraftTypes={aircraftTypes}
      seatingConfigs={seatingConfigs}
      airports={airports}
      serviceTypes={serviceTypes}
    />
  )
}
