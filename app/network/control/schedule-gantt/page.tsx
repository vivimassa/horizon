import dynamic from 'next/dynamic'
import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAllAircraftSeatingConfigs } from '@/app/actions/aircraft-registrations'
import { getAirports } from '@/app/actions/airports'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'

const GanttChart = dynamic(
  () => import('@/components/network/gantt-chart').then(mod => mod.GanttChart),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <span className="text-[13px] text-muted-foreground animate-pulse">Loading Gantt Chart...</span>
      </div>
    ),
  }
)

export default async function ScheduleGanttPage() {
  const [registrations, aircraftTypes, seatingConfigs, airports, serviceTypes] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
    getAllAircraftSeatingConfigs(),
    getAirports(),
    getFlightServiceTypes(),
  ])

  return (
    <GanttChart
      registrations={registrations}
      aircraftTypes={aircraftTypes}
      seatingConfigs={seatingConfigs}
      airports={airports}
      serviceTypes={serviceTypes}
    />
  )
}
