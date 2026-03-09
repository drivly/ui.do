import { useState, useCallback, useEffect, useRef, Component, type ReactNode } from 'react'
import { useSession } from './hooks/useSession'
import { useApps } from './hooks/useApps'
import { useNouns } from './hooks/useNouns'
import { redirectToLogin, deleteApp, type AppRecord, type Domain } from './api'
import { DashboardView } from './pages/DashboardView'
import { EntityListView } from './pages/EntityListView'
import { SchemaView } from './pages/SchemaView'
import { UoDView } from './pages/UoDView'
import { BuildView } from './pages/BuildView'
import { OverboardView } from './pages/OverboardView'
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

/** Extract domains from an app record (handles both populated and ID-only) */
function getAppDomains(app: AppRecord): Domain[] {
  if (!app.domains) return []
  return (app.domains as any[]).filter(d => typeof d === 'object' && d !== null)
}

/** Format an app name for display */
function formatAppLabel(app: AppRecord): string {
  const raw = app.name || app.slug
  if (raw.includes(' ')) return raw
  return raw.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

function AppContent() {
  const { session, isAdmin, loading: sessionLoading } = useSession()
  const { apps, loading: appsLoading, error: appsError, refresh: refreshApps } = useApps()
  const { dark, toggle: toggleTheme } = useTheme()

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null)
  const [view, setView] = useState<View>({ type: 'dashboard' })
  const [urlRestored, setUrlRestored] = useState(false)
  const [appDropdownOpen, setAppDropdownOpen] = useState(false)
  const [pendingAppSlug, setPendingAppSlug] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAppDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Restore state from URL once apps are loaded
  useEffect(() => {
    if (urlRestored || apps.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const appSlug = params.get('app')
    const domainSlug = params.get('domain')
    const viewType = params.get('view')

    if (viewType === 'build') {
      setView({ type: 'build' })
      setUrlRestored(true)
      return
    }

    // Find app by slug
    if (appSlug) {
      const app = apps.find(a => a.slug === appSlug)
      if (app) {
        setSelectedAppId(app.id)
        const domains = getAppDomains(app)
        // Find domain within app
        if (domainSlug) {
          const domain = domains.find(d => (d.domainSlug || d.slug) === domainSlug)
          if (domain) setSelectedDomainId(domain.id)
          else if (domains.length === 1) setSelectedDomainId(domains[0].id)
        } else if (domains.length === 1) {
          setSelectedDomainId(domains[0].id)
        }
        // Multi-domain apps with no domain slug → overboard (selectedDomainId stays null)
      }
    }

    if (viewType === 'uod') setView({ type: 'uod' })
    else if (viewType === 'schema') setView({ type: 'schema' })
    else if (viewType === 'entity') {
      const noun = params.get('noun')
      if (noun) setView({ type: 'entity', noun })
    }

    setUrlRestored(true)
  }, [apps, urlRestored])

  // Sync state to URL
  useEffect(() => {
    if (!urlRestored || apps.length === 0) return
    const params = new URLSearchParams()
    const selectedApp = apps.find(a => a.id === selectedAppId)
    if (selectedApp) params.set('app', selectedApp.slug)
    if (selectedDomainId && selectedApp) {
      const domains = getAppDomains(selectedApp)
      const domain = domains.find(d => d.id === selectedDomainId)
      if (domain && domains.length > 1) params.set('domain', domain.domainSlug || domain.slug || domain.id)
    }
    if (view.type !== 'dashboard') params.set('view', view.type)
    if (view.type === 'entity') params.set('noun', (view as any).noun)

    const search = params.toString()
    const url = search ? `?${search}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [apps, selectedAppId, selectedDomainId, view, urlRestored])

  const selectedApp = selectedAppId ? apps.find(a => a.id === selectedAppId) : undefined
  const appDomains = selectedApp ? getAppDomains(selectedApp) : []
  const selectedDomain = selectedDomainId ? appDomains.find(d => d.id === selectedDomainId) || appDomains[0] : (appDomains.length === 1 ? appDomains[0] : null)
  const { nouns } = useNouns(selectedDomain?.id)

  // When apps refresh and we have a pending slug, select the new app
  useEffect(() => {
    if (!pendingAppSlug || apps.length === 0) return
    const app = apps.find(a => a.slug === pendingAppSlug)
    if (app) {
      setSelectedAppId(app.id)
      const domains = getAppDomains(app)
      // Multi-domain apps start on overboard ("All" tab), single-domain auto-selects
      if (domains.length === 1) setSelectedDomainId(domains[0].id)
      else setSelectedDomainId(null)
      setView({ type: 'dashboard' })
      setPendingAppSlug(null)
    }
  }, [apps, pendingAppSlug])

  // Auto-select first app if none selected
  useEffect(() => {
    if (!selectedAppId && apps.length > 0 && view.type !== 'build' && view.type !== 'uod') {
      setSelectedAppId(apps[0].id)
      const domains = getAppDomains(apps[0])
      // Multi-domain apps start on overboard, single-domain auto-selects
      if (domains.length === 1) setSelectedDomainId(domains[0].id)
      else setSelectedDomainId(null)
    }
  }, [apps, selectedAppId, view.type])

  if (sessionLoading) return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">Loading...</div>

  const handleSelectApp = (appId: string) => {
    setSelectedAppId(appId)
    setAppDropdownOpen(false)
    const app = apps.find(a => a.id === appId)
    const domains = app ? getAppDomains(app) : []
    // Multi-domain apps start on overboard, single-domain auto-selects
    setSelectedDomainId(domains.length === 1 ? domains[0].id : null)
    setView({ type: 'dashboard' })
  }

  const handleSelectDomain = (domainId: string) => {
    setSelectedDomainId(domainId)
    setView({ type: 'dashboard' })
  }

  const handleBuildComplete = (slug: string) => {
    setPendingAppSlug(slug)
    refreshApps()
  }

  const handleDeleteApp = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this app? This cannot be undone.')) return
    try {
      await deleteApp(appId)
      if (selectedAppId === appId) {
        setSelectedAppId(null)
        setSelectedDomainId(null)
        setView({ type: 'dashboard' })
      }
      refreshApps()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete app')
    }
    setAppDropdownOpen(false)
  }

  return (
    <div className="flex flex-col h-dvh bg-background overflow-hidden">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display font-bold text-base tracking-tight flex-shrink-0 text-foreground">ui.do</span>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            {appsLoading ? (
              <span className="text-sm text-muted-foreground">Loading...</span>
            ) : appsError ? (
              <span className="text-sm text-destructive">{appsError}</span>
            ) : (
              <>
                {/* App dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setAppDropdownOpen(!appDropdownOpen)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 ${
                      selectedApp
                        ? 'bg-primary-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {selectedApp ? formatAppLabel(selectedApp) : 'Select App'}
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  {appDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                      {apps.map(app => (
                        <button
                          key={app.id}
                          onClick={() => handleSelectApp(app.id)}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            app.id === selectedAppId
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{formatAppLabel(app)}</div>
                            <button
                              onClick={(e) => handleDeleteApp(app.id, e)}
                              className="p-0.5 rounded text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete app"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                          </div>
                          <div className="text-xs text-muted-foreground">{getAppDomains(app).length} domain{getAppDomains(app).length !== 1 ? 's' : ''}</div>
                        </button>
                      ))}
                      {apps.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No apps yet</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Domain tabs within selected app */}
                {selectedApp && appDomains.length > 1 && (
                  <div className="flex items-center gap-1 border-l border-border pl-2 ml-1">
                    <button
                      onClick={() => { setSelectedDomainId(null); setView({ type: 'dashboard' }) }}
                      className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                        !selectedDomainId
                          ? 'bg-muted text-foreground font-medium'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      All
                    </button>
                    {appDomains.map(d => (
                      <button
                        key={d.id}
                        onClick={() => handleSelectDomain(d.id)}
                        className={`px-2.5 py-1 text-xs rounded-md transition-colors whitespace-nowrap ${
                          d.id === selectedDomain?.id
                            ? 'bg-muted text-foreground font-medium'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        {formatDomainLabel(d)}
                      </button>
                    ))}
                  </div>
                )}
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
          {!session && !appsLoading && apps.length === 0 && view.type !== 'build' && (
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
          {view.type === 'uod' && selectedApp && (
            <UoDView domains={appDomains} onSelectDomain={handleSelectDomain} />
          )}
          {view.type === 'dashboard' && !selectedDomainId && selectedApp && appDomains.length > 1 && (
            <OverboardView
              domains={appDomains}
              appName={formatAppLabel(selectedApp)}
              onSelectDomain={handleSelectDomain}
              onNavigate={setView}
            />
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
