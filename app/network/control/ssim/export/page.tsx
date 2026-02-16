import { getSeasons } from '@/app/actions/ssim-import'
import { SsimExportWorkflow } from './ssim-export-workflow'

export default async function SSIMExportPage() {
  const seasons = await getSeasons()

  return <SsimExportWorkflow seasons={seasons} />
}
