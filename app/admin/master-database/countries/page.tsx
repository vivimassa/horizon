import { getCountriesWithZoneCounts } from '@/app/actions/countries'
import { CountriesMasterDetail } from '@/components/admin/countries-master-detail'

export default async function CountriesPage() {
  const countries = await getCountriesWithZoneCounts()

  return <CountriesMasterDetail countries={countries} />
}
