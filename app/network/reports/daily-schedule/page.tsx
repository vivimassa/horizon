import dynamic from 'next/dynamic'
import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'

const DailyScheduleReport = dynamic(
  () => import('./daily-schedule-report').then(mod => mod.DailyScheduleReport),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <span className="text-[13px] text-muted-foreground animate-pulse">Loading Report...</span>
      </div>
    ),
  }
)

export default async function DailySchedulePage() {
  const [registrations, aircraftTypes] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
  ])

  return (
    <DailyScheduleReport
      registrations={registrations}
      aircraftTypes={aircraftTypes}
    />
  )
}
