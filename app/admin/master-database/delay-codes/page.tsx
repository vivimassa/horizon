import { getDelayCodes } from '@/app/actions/delay-codes'
import { DelayCodesTable } from '@/components/admin/delay-codes-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function DelayCodesPage() {
  const delayCodes = await getDelayCodes()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Delay Codes</CardTitle>
          <CardDescription>
            Manage IATA standard delay codes grouped by category. Used for delay tracking and OTP reporting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DelayCodesTable delayCodes={delayCodes} />
        </CardContent>
      </Card>
    </div>
  )
}
