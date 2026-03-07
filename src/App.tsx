import { useState, Component, type ReactNode } from 'react'
import { useSession } from './hooks/useSession'
import { useDomains } from './hooks/useDomains'
import { useNouns } from './hooks/useNouns'
import { redirectToLogin } from './api'
import { DashboardView } from './pages/DashboardView'
import { EntityListView } from './pages/EntityListView'
import { SchemaView } from './pages/SchemaView'
import { UoDView } from './pages/UoDView'
import { BuildView } from './pages/BuildView'
import { formatNounName } from './utils'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-lg">
          <h2 className="text-red-800 font-semibold mb-2">Something went wrong</h2>
          <pre className="text-red-600 text-sm whitespace-pre-wrap">{this.state.error.message}</pre>
        </div>
      </div>
    )
    return this.props.children
  }
}

type View =
  | { type: 'dashboard' }
  | { type: 'entity'; noun: string }
  | { type: 'schema' }
  | { type: 'uod' }
  | { type: 'build' }

function domainLabel(d: { title?: string; name?: string; domainSlug?: string; slug?: string; id: string }) {
  return d.title || d.name || d.domainSlug || d.slug || d.id
}

function AppContent() {
  const { session, isAdmin, loading: sessionLoading } = useSession()
  const { domains, loading: domainsLoading, error: domainsError, refresh: refreshDomains } = useDomains()

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ type: 'dashboard' })

  // null = "All" (UoD) tab
  const selectedDomain = selectedDomainId === null ? undefined : (domains.find(d => d.id === selectedDomainId) || domains[0])
  const { nouns } = useNouns(selectedDomain?.id)

  if (sessionLoading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>

  const handleSelectDomain = (id: string) => {
    setSelectedDomainId(id)
    setView({ type: 'dashboard' })
  }

  const handleSelectAll = () => {
    setSelectedDomainId(null)
    setView({ type: 'uod' })
  }

  const handleBuildComplete = (slug: string) => {
    refreshDomains()
    const d = domains.find(d => (d.domainSlug || d.slug) === slug)
    if (d) setSelectedDomainId(d.id)
    setView({ type: 'dashboard' })
  }

  // Auto-select first domain if none selected and domains loaded
  if (selectedDomainId === null && domains.length > 0 && view.type !== 'build' && view.type !== 'uod') {
    setSelectedDomainId(domains[0].id)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Domain Switcher */}
      <header className="bg-white border-b px-4 py-2 flex items-center gap-0 min-h-[44px]">
        <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
          {domainsLoading ? (
            <span className="text-sm text-gray-400">Loading domains...</span>
          ) : domainsError ? (
            <span className="text-sm text-red-400">{domainsError}</span>
          ) : (
            <>
              <button
                onClick={handleSelectAll}
                className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                  selectedDomainId === null && view.type === 'uod'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}>
                All
              </button>
              {domains.map(d => (
                <button key={d.id}
                  onClick={() => handleSelectDomain(d.id)}
                  className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                    d.id === selectedDomain?.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}>
                  {domainLabel(d)}
                </button>
              ))}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <button
            onClick={() => setView({ type: 'build' })}
            className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg whitespace-nowrap">
            + New App
          </button>
          {session && (
            <span className="text-xs text-gray-400 whitespace-nowrap">{session.email}</span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Entity Sidebar — only shown when a domain is selected */}
        {selectedDomain && view.type !== 'build' && view.type !== 'uod' && (
          <nav className="w-48 bg-white border-r p-3 space-y-1 overflow-y-auto flex-shrink-0">
            <button
              onClick={() => setView({ type: 'dashboard' })}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                view.type === 'dashboard' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              Dashboard
            </button>
            <button
              onClick={() => setView({ type: 'schema' })}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                view.type === 'schema' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              Schema
            </button>
            <div className="border-t my-2" />
            {nouns.map(n => (
              <button key={n.id}
                onClick={() => setView({ type: 'entity', noun: n.name })}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                  view.type === 'entity' && (view as any).noun === n.name
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {formatNounName(n.plural || n.name)}
              </button>
            ))}
          </nav>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {!session && !domainsLoading && domains.length === 0 && view.type !== 'build' && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">Sign in to view your apps</p>
              <button onClick={redirectToLogin} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Sign In
              </button>
            </div>
          )}
          {view.type === 'build' && (
            <BuildView onComplete={handleBuildComplete} onCancel={() => setView({ type: 'dashboard' })} />
          )}
          {view.type === 'uod' && (
            <UoDView domains={domains} onSelectDomain={handleSelectDomain} />
          )}
          {view.type === 'dashboard' && selectedDomain && (
            <DashboardView domain={selectedDomain} nouns={nouns} isAdmin={isAdmin} onNavigate={setView} />
          )}
          {view.type === 'schema' && selectedDomain && (
            <SchemaView domain={selectedDomain} />
          )}
          {view.type === 'entity' && selectedDomain && (
            <EntityListView domain={selectedDomain} entityName={(view as any).noun} />
          )}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return <ErrorBoundary><AppContent /></ErrorBoundary>
}
