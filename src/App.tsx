import { useState } from 'react'
import { useSession } from './hooks/useSession'
import { useDomains } from './hooks/useDomains'
import { useNouns } from './hooks/useNouns'
import { DashboardView } from './pages/DashboardView'
import { EntityListView } from './pages/EntityListView'
import { UoDView } from './pages/UoDView'
import { BuildView } from './pages/BuildView'

type View = { type: 'dashboard' } | { type: 'entity'; noun: string } | { type: 'uod' } | { type: 'build' }

export default function App() {
  const { session, isAdmin, loading: sessionLoading } = useSession()
  const { domains, loading: domainsLoading, refresh: refreshDomains } = useDomains()

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ type: 'dashboard' })

  const selectedDomain = domains.find(d => d.id === selectedDomainId) || domains[0]
  const { nouns } = useNouns(selectedDomain?.id)

  if (sessionLoading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>

  const handleSelectDomain = (id: string) => {
    setSelectedDomainId(id)
    setView({ type: 'dashboard' })
  }

  const handleBuildComplete = (slug: string) => {
    refreshDomains()
    const d = domains.find(d => d.slug === slug)
    if (d) setSelectedDomainId(d.id)
    setView({ type: 'dashboard' })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Domain Switcher */}
      <header className="bg-white border-b px-4 py-2 flex items-center gap-1 overflow-x-auto">
        {domainsLoading ? (
          <span className="text-sm text-gray-400">Loading domains...</span>
        ) : (
          domains.map(d => (
            <button key={d.id}
              onClick={() => handleSelectDomain(d.id)}
              className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
                d.id === selectedDomain?.id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {d.title || d.slug}
            </button>
          ))
        )}
        <button
          onClick={() => setView({ type: 'build' })}
          className="ml-auto px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg whitespace-nowrap">
          + New App
        </button>
        {session && (
          <span className="text-xs text-gray-400 ml-2">{session.email}</span>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Entity Sidebar */}
        {selectedDomain && view.type !== 'build' && (
          <nav className="w-48 bg-white border-r p-3 space-y-1 overflow-y-auto flex-shrink-0">
            <button
              onClick={() => setView({ type: 'dashboard' })}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                view.type === 'dashboard' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
              }`}>
              Dashboard
            </button>
            <button
              onClick={() => setView({ type: 'uod' })}
              className={`w-full text-left px-3 py-2 text-sm rounded-lg ${
                view.type === 'uod' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
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
                {n.plural || n.name}
              </button>
            ))}
          </nav>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {view.type === 'build' && (
            <BuildView onComplete={handleBuildComplete} onCancel={() => setView({ type: 'dashboard' })} />
          )}
          {view.type === 'dashboard' && selectedDomain && (
            <DashboardView domain={selectedDomain} nouns={nouns} isAdmin={isAdmin} onNavigate={setView} />
          )}
          {view.type === 'uod' && selectedDomain && (
            <UoDView domain={selectedDomain} />
          )}
          {view.type === 'entity' && selectedDomain && (
            <EntityListView domain={selectedDomain} entityName={(view as any).noun} />
          )}
        </main>
      </div>
    </div>
  )
}
