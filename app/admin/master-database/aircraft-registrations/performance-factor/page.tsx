import { getPerformanceFactors, getPerformanceFactorPeriods } from '@/app/actions/performance-factor'
import { getAircraftRegistrations } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { PerformanceFactorPage } from '@/components/admin/performance-factor-page'

export default async function PFPage() {
  const [pfRecords, periods, registrations, aircraftTypes] = await Promise.all([
    getPerformanceFactors(),
    getPerformanceFactorPeriods(),
    getAircraftRegistrations(),
    getAircraftTypes(),
  ])

  return (
    <PerformanceFactorPage
      pfRecords={pfRecords}
      periods={periods}
      registrations={registrations}
      aircraftTypes={aircraftTypes}
    />
  )
}
