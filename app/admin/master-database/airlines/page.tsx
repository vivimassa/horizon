import { getAirlines } from '@/app/actions/airlines'
import { AirlinesMasterDetail } from '@/components/admin/airlines-master-detail'

export default async function AirlinesPage() {
  const airlines = await getAirlines()

  return <AirlinesMasterDetail airlines={airlines} />
}
