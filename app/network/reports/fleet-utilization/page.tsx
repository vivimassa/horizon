import dynamic from 'next/dynamic'
import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'

const FleetUtilizationReport = dynamic(
  () => import('./fleet-utilization-report').then(mod => mod.FleetUtilizationReport),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex items-center justify-center" style={{ height: 'calc(100vh - 120px)' }}>
        <span className="text-[13px] text-muted-foreground animate-pulse">Loading Report...</span>
      </div>
    ),
  }
)

export default async function FleetUtilizationPage() {
  const [registrations, aircraftTypes] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
  ])

  return (
    <FleetUtilizationReport
      registrations={registrations}
      aircraftTypes={aircraftTypes}
    />
  )
}
