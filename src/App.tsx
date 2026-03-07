import { useState, useCallback, useEffect, Component, type ReactNode } from 'react'
import { useSession } from './hooks/useSession'
import { useDomains } from './hooks/useDomains'
import { useNouns } from './hooks/useNouns'
import { redirectToLogin } from './api'
import { DashboardView } from './pages/DashboardView'
import { EntityListView } from './pages/EntityListView'
import { SchemaView } from './pages/SchemaView'
import { UoDView } from './pages/UoDView'
import { BuildView } from './pages/BuildView'
import { nounDisplayName, formatDomainLabel } from './utils'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 max-w-lg">
          <h2 className="text-destructive font-semibold mb-2 font-display">Something went wrong</h2>
          <pre className="text-destructive/80 text-sm whitespace-pre-wrap">{this.state.error.message}</pre>
        </div>
      </div>
    )
    return this.props.children
  }
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = useCallback(() => {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
    setDark(next)
  }, [dark])
  return { dark, toggle }
}

type View =
  | { type: 'dashboard' }
  | { type: 'entity'; noun: string }
  | { type: 'schema' }
  | { type: 'uod' }
  | { type: 'build' }


function parseUrlState(domains: { id: string; domainSlug?: string; slug?: string }[]): { domainId: string | null; view: View } | null {
  const params = new URLSearchParams(window.location.search)
  const domainSlug = params.get('domain')
  const viewType = params.get('view')
  if (!domainSlug && !viewType) return null

  if (viewType === 'uod') return { domainId: null, view: { type: 'uod' } }
  if (viewType === 'build') return { domainId: null, view: { type: 'build' } }

  const domain = domainSlug ? domains.find(d => (d.domainSlug || d.slug) === domainSlug) : undefined
  const domainId = domain?.id || null

  if (viewType === 'schema') return { domainId, view: { type: 'schema' } }
  if (viewType === 'entity') {
    const noun = params.get('noun')
    if (noun) return { domainId, view: { type: 'entity', noun } }
  }

  return { domainId, view: { type: 'dashboard' } }
}

function syncUrlState(domains: { id: string; domainSlug?: string; slug?: string }[], domainId: string | null, view: View) {
  const params = new URLSearchParams()
  if (domainId) {
    const d = domains.find(d => d.id === domainId)
    if (d) params.set('domain', d.domainSlug || d.slug || d.id)
  }
  if (view.type !== 'dashboard') params.set('view', view.type)
  if (view.type === 'entity') params.set('noun', (view as any).noun)

  const search = params.toString()
  const url = search ? `?${search}` : window.location.pathname
  window.history.replaceState(null, '', url)
}

function AppContent() {
  const { session, isAdmin, loading: sessionLoading } = useSession()
  const { domains, loading: domainsLoading, error: domainsError, refresh: refreshDomains } = useDomains()
  const { dark, toggle: toggleTheme } = useTheme()

  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ type: 'dashboard' })
  const [urlRestored, setUrlRestored] = useState(false)

  // Restore state from URL once domains are loaded
  useEffect(() => {
    if (urlRestored || domains.length === 0) return
    const state = parseUrlState(domains)
    if (state) {
      setSelectedDomainId(state.domainId)
      setView(state.view)
    }
    setUrlRestored(true)
  }, [domains, urlRestored])

  // Sync state to URL whenever it changes
  useEffect(() => {
    if (!urlRestored || domains.length === 0) return
    syncUrlState(domains, selectedDomainId, view)
  }, [domains, selectedDomainId, view, urlRestored])

  const selectedDomain = selectedDomainId === null ? undefined : (domains.find(d => d.id === selectedDomainId) || domains[0])
  const { nouns } = useNouns(selectedDomain?.id)

  if (sessionLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>

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
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Header — adapts to theme like auto.dev dashboard */}
      <header className="bg-card border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-base tracking-tight flex-shrink-0 text-foreground">ui.do</span>

          <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
            {domainsLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : domainsError ? (
              <span className="text-sm text-destructive">{domainsError}</span>
            ) : (
              <>
                <button
                  onClick={handleSelectAll}
                  className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${
                    selectedDomainId === null && view.type === 'uod'
                      ? 'bg-primary-600 text-white'
                      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`}>
                  All
                </button>
                {domains.map(d => (
                  <button key={d.id}
                    onClick={() => handleSelectDomain(d.id)}
                    className={`px-3 py-1 text-sm rounded-md transition-colors whitespace-nowrap ${
                      d.id === selectedDomain?.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}>
                    {formatDomainLabel(d)}
                  </button>
                ))}
              </>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setView({ type: 'build' })}
              className="px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors whitespace-nowrap">
              + New App
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
              )}
            </button>
            {session && (
              <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">{session.email}</span>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {selectedDomain && view.type !== 'build' && view.type !== 'uod' && (
          <nav className="w-48 bg-card border-r border-border p-3 space-y-0.5 overflow-y-auto flex-shrink-0">
            <button
              onClick={() => setView({ type: 'dashboard' })}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                view.type === 'dashboard' ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400 font-medium' : 'text-foreground hover:bg-muted'
              }`}>
              Dashboard
            </button>
            <button
              onClick={() => setView({ type: 'schema' })}
              className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                view.type === 'schema' ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400 font-medium' : 'text-foreground hover:bg-muted'
              }`}>
              Schema
            </button>
            <div className="border-t border-border my-2" />
            {nouns.map(n => (
              <button key={n.id}
                onClick={() => setView({ type: 'entity', noun: n.name })}
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                  view.type === 'entity' && (view as any).noun === n.name
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400 font-medium'
                    : 'text-foreground hover:bg-muted'
                }`}>
                {nounDisplayName(n)}
              </button>
            ))}
          </nav>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {!session && !domainsLoading && domains.length === 0 && view.type !== 'build' && (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">Sign in to view your apps</p>
              <button onClick={redirectToLogin} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
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
