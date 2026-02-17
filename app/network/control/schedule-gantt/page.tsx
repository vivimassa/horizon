import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAllAircraftSeatingConfigs } from '@/app/actions/aircraft-registrations'
import { GanttChart } from '@/components/network/gantt-chart'

export default async function ScheduleGanttPage() {
  const [registrations, aircraftTypes, seatingConfigs] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
    getAllAircraftSeatingConfigs(),
  ])

  return (
    <GanttChart
      registrations={registrations}
      aircraftTypes={aircraftTypes}
      seatingConfigs={seatingConfigs}
    />
  )
}
