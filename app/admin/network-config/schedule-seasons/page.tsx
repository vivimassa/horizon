import { getScheduleSeasons } from '@/app/actions/schedule-seasons'
import { ScheduleSeasonsTable } from '@/components/admin/schedule-seasons-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ScheduleSeasonsPage() {
  const seasons = await getScheduleSeasons()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule Seasons</CardTitle>
          <CardDescription>
            Manage IATA schedule seasons and their active date ranges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduleSeasonsTable seasons={seasons} />
        </CardContent>
      </Card>
    </div>
  )
}
