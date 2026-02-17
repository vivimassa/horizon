import { getSeasons } from '@/app/actions/ssim-import'
import { getAirportOptions, getServiceTypeOptions } from '@/app/actions/ssim-export'
import { SsimExportWorkflow } from './ssim-export-workflow'

export default async function SSIMExportPage() {
  const [seasons, airports, serviceTypes] = await Promise.all([
    getSeasons(),
    getAirportOptions(),
    getServiceTypeOptions(),
  ])

  return (
    <SsimExportWorkflow
      seasons={seasons}
      airports={airports}
      serviceTypes={serviceTypes}
    />
  )
}
