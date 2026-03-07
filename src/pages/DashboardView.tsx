import type { Domain, Noun } from '../api'
import { formatNounName } from '../utils'

type View = { type: 'dashboard' } | { type: 'entity'; noun: string } | { type: 'schema' } | { type: 'uod' } | { type: 'build' }

interface Props {
  domain: Domain
  nouns: Noun[]
  isAdmin: boolean
  onNavigate: (view: View) => void
}

export function DashboardView({ domain, nouns, isAdmin, onNavigate }: Props) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{domain.title || domain.name || domain.domainSlug || domain.slug}</h1>
        <p className="text-sm text-gray-500">{nouns.length} {nouns.length === 1 ? 'entity' : 'entities'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {nouns.map(n => (
          <button key={n.id}
            onClick={() => onNavigate({ type: 'entity', noun: n.name })}
            className="bg-white border rounded-xl p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all">
            <div className="text-sm font-medium text-gray-900">{formatNounName(n.plural || n.name)}</div>
            <div className="text-xs text-gray-400 mt-1">View all</div>
          </button>
        ))}

        <button
          onClick={() => onNavigate({ type: 'schema' })}
          className="bg-white border border-dashed rounded-xl p-4 text-left hover:border-blue-300 transition-all">
          <div className="text-sm font-medium text-gray-600">Schema</div>
          <div className="text-xs text-gray-400 mt-1">View schema</div>
        </button>
      </div>

      {isAdmin && (
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-700">
            Dashboard layout customization coming soon. Admins will be able to configure widgets and set default layouts for users.
          </p>
        </div>
      )}
    </div>
  )
}
