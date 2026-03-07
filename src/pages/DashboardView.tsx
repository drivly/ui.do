import type { Domain, Noun } from '../api'
type View = { type: 'dashboard' } | { type: 'entity'; noun: string } | { type: 'uod' } | { type: 'build' }
interface Props { domain: Domain; nouns: Noun[]; isAdmin: boolean; onNavigate: (view: View) => void }
export function DashboardView({ domain }: Props) {
  return <div className="text-gray-500">Dashboard for {domain.slug} — coming soon</div>
}
