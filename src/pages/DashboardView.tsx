import type { Domain, Noun } from '../api'
import { nounDisplayName, formatDomainLabel } from '../utils'

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
        <h1 className="text-xl font-bold text-foreground font-display">{formatDomainLabel(domain)}</h1>
        <p className="text-sm text-muted-foreground">{nouns.length} {nouns.length === 1 ? 'entity' : 'entities'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {nouns.map(n => (
          <button key={n.id}
            onClick={() => onNavigate({ type: 'entity', noun: n.name })}
            className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all">
            <div className="text-sm font-medium text-card-foreground">{nounDisplayName(n)}</div>
            <div className="text-xs text-muted-foreground mt-1">View all</div>
          </button>
        ))}

        <button
          onClick={() => onNavigate({ type: 'schema' })}
          className="bg-card border border-dashed border-border rounded-xl p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-all">
          <div className="text-sm font-medium text-muted-foreground">Schema</div>
          <div className="text-xs text-muted-foreground mt-1">View schema</div>
        </button>
      </div>

      {isAdmin && (
        <div className="mt-8 p-4 bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800 rounded-lg">
          <p className="text-sm text-primary-700 dark:text-primary-300">
            Dashboard layout customization coming soon. Admins will be able to configure widgets and set default layouts for users.
          </p>
        </div>
      )}
    </div>
  )
}
