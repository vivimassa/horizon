import { redirect } from 'next/navigation'

export default function NetworkPage() {
  // Redirect to control tab by default
  redirect('/network/control')
}
