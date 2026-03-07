import type { Domain } from '../api'
interface Props { domain: Domain; entityName: string }
export function EntityListView({ entityName }: Props) {
  return <div className="text-gray-500">Entity list for {entityName} — coming soon</div>
}
