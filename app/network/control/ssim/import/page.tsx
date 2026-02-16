import { getSeasons } from '@/app/actions/ssim-import'
import { SsimImportWorkflow } from './ssim-import-workflow'

export default async function SSIMImportPage() {
  const seasons = await getSeasons()

  return <SsimImportWorkflow seasons={seasons} />
}
