import { getAircraftTypes, getAllSeatingConfigs } from '@/app/actions/aircraft-types'
import { AircraftTypesMasterDetail } from '@/components/admin/aircraft-types-master-detail'

export default async function AircraftTypesPage() {
  const [aircraftTypes, seatingConfigs] = await Promise.all([
    getAircraftTypes(),
    getAllSeatingConfigs(),
  ])

  return <AircraftTypesMasterDetail aircraftTypes={aircraftTypes} seatingConfigs={seatingConfigs} />
}
