import { getAircraftRegistrations, getAllAircraftSeatingConfigs } from '@/app/actions/aircraft-registrations'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getAirports } from '@/app/actions/airports'
import { AircraftRegistrationsMasterDetail } from '@/components/admin/aircraft-registrations-master-detail'

export default async function AircraftRegistrationsPage() {
  const [aircraft, aircraftTypes, airports, seatingConfigs] = await Promise.all([
    getAircraftRegistrations(),
    getAircraftTypes(),
    getAirports(),
    getAllAircraftSeatingConfigs(),
  ])

  return (
    <AircraftRegistrationsMasterDetail
      aircraft={aircraft}
      aircraftTypes={aircraftTypes}
      airports={airports}
      seatingConfigs={seatingConfigs}
    />
  )
}
