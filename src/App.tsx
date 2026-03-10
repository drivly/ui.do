import { useState, useCallback, useEffect, useRef, useMemo, Component, type ReactNode } from 'react'
import { useSession } from './hooks/useSession'
import { useApps } from './hooks/useApps'
import { useOrganizations } from './hooks/useOrganizations'
import { useNouns } from './hooks/useNouns'
import { redirectToLogin, deleteApp, type AppRecord, type Domain, type Organization } from './api'
import { DashboardView } from './pages/DashboardView'
import { EntityListView } from './pages/EntityListView'
import { SchemaView } from './pages/SchemaView'
import { UoDView } from './pages/UoDView'
import { BuildView } from './pages/BuildView'
import { OverboardView } from './pages/OverboardView'
import { ChatOverboardView } from './pages/ChatOverboardView'
import { nounDisplayName, formatDomainLabel } from './utils'
import { PaneLayout, usePaneNavigation } from './layout'

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

/** Get the org ID from an app record (handles populated and ID-only) */
function getAppOrgId(app: AppRecord): string | null {
  if (!app.organization) return null
  return typeof app.organization === 'string' ? app.organization : app.organization.id
}

/** Format org name for display */
function formatOrgName(org: Organization): string {
  const raw = org.name || org.slug || org.id
  if (raw.includes(' ')) return raw
  return raw.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

function AppContent() {
  const { session, isAdmin, loading: sessionLoading } = useSession()
  const { apps, loading: appsLoading, error: appsError, refresh: refreshApps } = useApps()
  const { orgs } = useOrganizations()
  const { dark, toggle: toggleTheme } = useTheme()

  const { layout, closePopover } = usePaneNavigation()

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
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

  // Auto-select first org when orgs load
  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id)
    }
  }, [orgs, selectedOrgId])

  // Filter apps by selected org
  const filteredApps = selectedOrgId
    ? apps.filter(a => getAppOrgId(a) === selectedOrgId)
    : apps

  // Restore state from URL once apps are loaded
  useEffect(() => {
    if (urlRestored || apps.length === 0) return
    const params = new URLSearchParams(window.location.search)
    const appSlug = params.get('app')
    const domainSlug = params.get('domain')
    const viewType = params.get('view')
    const orgSlug = params.get('org')

    // Restore org from URL
    if (orgSlug && orgs.length > 0) {
      const org = orgs.find(o => o.slug === orgSlug)
      if (org) setSelectedOrgId(org.id)
    }

    if (viewType === 'build') {
      setView({ type: 'build' })
      setUrlRestored(true)
      return
    }

    // Find app by slug
    if (appSlug) {
      const app = apps.find(a => a.slug === appSlug)
      if (app) {
        // Also set org to match the app's org
        const appOrgId = getAppOrgId(app)
        if (appOrgId) setSelectedOrgId(appOrgId)
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
  }, [apps, orgs, urlRestored])

  // Sync state to URL
  useEffect(() => {
    if (!urlRestored || apps.length === 0) return
    const params = new URLSearchParams()
    const selectedOrg = orgs.find(o => o.id === selectedOrgId)
    if (selectedOrg && orgs.length > 1) params.set('org', selectedOrg.slug || selectedOrg.id)
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
  }, [apps, orgs, selectedOrgId, selectedAppId, selectedDomainId, view, urlRestored])

  const selectedApp = selectedAppId ? filteredApps.find(a => a.id === selectedAppId) || apps.find(a => a.id === selectedAppId) : undefined
  const appDomains = useMemo(() => selectedApp ? getAppDomains(selectedApp) : [], [selectedApp])
  const navDomains = useMemo(() => {
    if (!selectedApp?.navigableDomains || selectedApp.navigableDomains.length === 0) return appDomains
    return appDomains.filter(d => selectedApp.navigableDomains!.includes(d.id))
  }, [selectedApp, appDomains])
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

  // Auto-select first app if none selected (or current app not in filtered list)
  useEffect(() => {
    if (view.type === 'build' || view.type === 'uod') return
    const currentInFiltered = selectedAppId && filteredApps.some(a => a.id === selectedAppId)
    if (!currentInFiltered && filteredApps.length > 0) {
      setSelectedAppId(filteredApps[0].id)
      const domains = getAppDomains(filteredApps[0])
      if (domains.length === 1) setSelectedDomainId(domains[0].id)
      else setSelectedDomainId(null)
    } else if (!currentInFiltered && filteredApps.length === 0) {
      setSelectedAppId(null)
      setSelectedDomainId(null)
    }
  }, [filteredApps, selectedAppId, view.type])

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
      <header className="bg-card border-b border-border px-4 py-2 flex-shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 flex-shrink-0">
            {appsLoading ? (
              <span className="text-sm text-muted-foreground font-display font-bold">ui.do</span>
            ) : appsError === 'Unauthorized' ? (
              <button onClick={redirectToLogin} className="text-sm text-primary-400 hover:text-primary-300 transition-colors font-display font-bold">ui.do — Sign in</button>
            ) : appsError ? (
              <span className="text-sm text-destructive">{appsError}</span>
            ) : (
              <>
                {/* App dropdown with logo */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setAppDropdownOpen(!appDropdownOpen)}
                    className="px-3 py-1.5 text-sm rounded-md transition-colors flex items-center gap-1.5 bg-muted text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="font-display font-bold">ui.do</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </button>

                  {appDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                      {/* Home — overboard for multi-domain apps */}
                      {selectedApp && appDomains.length > 1 && (
                        <button
                          onClick={() => { setSelectedDomainId(null); setView({ type: 'dashboard' }); setAppDropdownOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                            !selectedDomainId
                              ? 'bg-accent text-accent-foreground font-medium'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                          {formatAppLabel(selectedApp)}
                        </button>
                      )}
                      {filteredApps.filter(a => a.id !== selectedAppId).map(app => (
                        <button
                          key={app.id}
                          onClick={() => handleSelectApp(app.id)}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          <div className="font-medium">{formatAppLabel(app)}</div>
                          <div className="text-xs text-muted-foreground">{getAppDomains(app).length} domain{getAppDomains(app).length !== 1 ? 's' : ''}</div>
                        </button>
                      ))}

                      <div className="border-b border-border my-1" />

                      {/* New App */}
                      <button
                        onClick={() => { setView({ type: 'build' }); setAppDropdownOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
                        New App
                      </button>

                      {/* Delete current app */}
                      {selectedApp && (
                        <button
                          onClick={(e) => { handleDeleteApp(selectedAppId!, e); setAppDropdownOpen(false) }}
                          className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                          Delete App
                        </button>
                      )}

                      {/* Workspace picker */}
                      {orgs.length > 0 && (
                        <>
                          <div className="border-b border-border my-1" />
                          <div className="px-3 pt-2 pb-1">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Workspace</div>
                          </div>
                          {orgs.map(org => (
                            <button
                              key={org.id}
                              onClick={() => {
                                setSelectedOrgId(org.id)
                                setAppDropdownOpen(false)
                              }}
                              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                                org.id === selectedOrgId
                                  ? 'bg-accent text-accent-foreground font-medium'
                                  : 'text-foreground hover:bg-muted'
                              }`}
                            >
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                org.id === selectedOrgId
                                  ? 'bg-primary-600 text-white'
                                  : 'bg-muted-foreground/20 text-muted-foreground'
                              }`}>
                                {(org.name || '?')[0].toUpperCase()}
                              </span>
                              <span className="truncate">{formatOrgName(org)}</span>
                              {org.id === selectedOrgId && (
                                <svg className="ml-auto flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </button>
                          ))}
                        </>
                      )}

                      <div className="border-b border-border my-1" />

                      {/* User & theme */}
                      {session && (
                        <div className="px-3 py-1.5">
                          <div className="text-xs text-muted-foreground">{session.email}</div>
                        </div>
                      )}
                      <button
                        onClick={() => { toggleTheme(); setAppDropdownOpen(false) }}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        {dark ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                        )}
                        {dark ? 'Light mode' : 'Dark mode'}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Domain tabs — inline, wrapping with header */}
          {selectedApp && navDomains.length > 0 && navDomains.map(d => (
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
      </header>

      <PaneLayout
        layout={{
          ...layout,
          detail: { ...layout.detail, current: (selectedDomain || (!selectedDomainId && selectedApp && (appDomains.length > 1 || selectedApp.chatEndpoint))) ? view.type : null },
        }}
        hideMaster={!selectedDomain}
        renderMaster={() => (
          <>
            {selectedDomain && view.type !== 'build' && view.type !== 'uod' && (
              <nav className="p-3 space-y-0.5 overflow-y-auto flex-1">
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
          </>
        )}
        renderDetail={() => (
          <main className={`flex-1 overflow-y-auto ${view.type === 'dashboard' && !selectedDomainId && selectedApp?.chatEndpoint ? '' : 'p-6'}`}>
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
            {view.type === 'dashboard' && !selectedDomainId && selectedApp && (appDomains.length > 1 || selectedApp.chatEndpoint) && (
              selectedApp.chatEndpoint
                ? <ChatOverboardView appName={formatAppLabel(selectedApp)} endpoint={selectedApp.chatEndpoint} />
                : <OverboardView
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
        )}
        onClosePopover={closePopover}
      />
    </div>
  )
}

export default function App() {
  return <ErrorBoundary><AppContent /></ErrorBoundary>
}
