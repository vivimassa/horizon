import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { getAircraftTypes } from '@/app/actions/aircraft-types'
import { getOperatorProfile } from '@/app/actions/operator-profile'
import { ScheduleMessages } from '@/components/network/schedule-messages'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ScheduleMessagesPage() {
  const [seasons, aircraftTypes, operator] = await Promise.all([
    getScheduleSeasons(),
    getAircraftTypes(),
    getOperatorProfile(),
  ])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule Message Manager</CardTitle>
        <CardDescription>
          SSIM file upload/download and ASM/SSM schedule change messages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScheduleMessages
          seasons={seasons}
          aircraftTypes={aircraftTypes}
          operatorIataCode={operator?.iata_code || ''}
        />
      </CardContent>
    </Card>
  )
}
