import type { Domain } from '../api'
interface Props { domain: Domain }
export function UoDView({ domain }: Props) {
  return <div className="text-gray-500">Universe of Discourse for {domain.slug} — coming soon</div>
}
