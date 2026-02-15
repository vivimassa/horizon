import { getDelayCodes } from '@/app/actions/delay-codes'
import { DelayCodesMasterDetail } from '@/components/admin/delay-codes-master-detail'

export default async function DelayCodesPage() {
  const delayCodes = await getDelayCodes()

  return <DelayCodesMasterDetail delayCodes={delayCodes} />
}
