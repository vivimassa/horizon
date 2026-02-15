import { getFlightServiceTypes } from '@/app/actions/flight-service-types'
import { FlightServiceTypesMasterDetail } from '@/components/admin/flight-service-types-master-detail'

export default async function FlightServiceTypesPage() {
  const types = await getFlightServiceTypes()

  return <FlightServiceTypesMasterDetail flightServiceTypes={types} />
}
