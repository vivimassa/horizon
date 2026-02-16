import { getUomSettings } from '@/app/actions/uom-settings'
import { UomSettingsForm } from './uom-settings-form'

export default async function UnitsOfMeasurePage() {
  const settings = await getUomSettings()

  return <UomSettingsForm initialSettings={settings} />
}
