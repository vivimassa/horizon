import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAllAircraftSeatingConfigs } from '@/app/actions/aircraft-registrations'
import { getAirports } from '@/app/actions/airports'
import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { GanttChart } from '@/components/network/gantt-chart'

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
