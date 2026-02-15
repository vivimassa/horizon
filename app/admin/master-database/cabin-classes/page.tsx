import { getCabinClasses } from '@/app/actions/cabin-classes'
import { CabinClassesMasterDetail } from '@/components/admin/cabin-classes-master-detail'

export default async function CabinClassesPage() {
  const cabinClasses = await getCabinClasses()

  return <CabinClassesMasterDetail cabinClasses={cabinClasses} />
}
