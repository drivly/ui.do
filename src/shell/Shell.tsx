import { useState, useSyncExternalStore } from 'react'
import type { Store, Resource } from '../rho/store'

interface ShellProps {
  store: Store
}

export default function Shell({ store }: ShellProps) {
  useSyncExternalStore(store.subscribe, store.getSnapshot)

  const [masterHref, setMasterHref] = useState<string | null>(null)
  const [detailHref, setDetailHref] = useState<string | null>(null)

  const root = store.getResource('/arest/')
  const masterResource = masterHref ? store.getResource(masterHref) : null
  const detailResource = detailHref ? store.getResource(detailHref) : null

  // Derive org from root links
  const orgLinks = root?._links?.organizations || []
  const firstOrg = orgLinks[0]
  const orgResource = firstOrg ? store.getResource(firstOrg.href) : null

  // Auto-follow first org link on root load
  if (firstOrg && !orgResource) {
    store.followLink(firstOrg.href).catch(console.error)
  }

  // Derive domain tabs from org's child links (exclude self)
  const domainTabs = orgResource?._links
    ? Object.entries(orgResource._links)
        .filter(([key]) => key !== 'self')
        .map(([key, link]: [string, any]) => ({
          key,
          href: link.href,
          factType: link.factType,
          active: masterHref === link.href,
        }))
    : []

  function handleTabClick(href: string) {
    store.followLink(href).then(() => {
      setMasterHref(href)
      setDetailHref(null)
    }).catch(console.error)
  }

  function handleSelectEntity(href: string) {
    store.followLink(href).then(() => setDetailHref(href)).catch(console.error)
  }

  function handleFollowLink(href: string, pane: 'master' | 'detail') {
    store.followLink(href).then(() => {
      if (pane === 'master') {
        setMasterHref(href)
        setDetailHref(null)
      } else {
        setDetailHref(href)
      }
    }).catch(console.error)
  }

  // Resolve views from DEFS
  const MasterView = masterResource?.docs
    ? store.resolveDef('collection')
    : masterResource?.type
      ? store.resolveDef(masterResource.type)
      : null

  const DetailViewComponent = detailResource?.type
    ? store.resolveDef(detailResource.type)
    : null

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Header + Tabs Pane */}
      <header className="flex items-center px-4 h-12 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold mr-6" style={{ color: 'var(--accent)' }}>
          {firstOrg?.title || 'ui.do'}
        </span>
        <nav className="flex gap-1">
          {domainTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.href)}
              className="px-3 py-1.5 text-xs rounded-md transition-colors"
              style={{
                background: tab.active ? 'var(--accent)' : 'transparent',
                color: tab.active ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
              }}
            >
              {tab.key}
            </button>
          ))}
        </nav>
      </header>

      {/* Master + Detail Panes */}
      <div className="flex flex-1 overflow-hidden">
        {/* Master Pane */}
        <div className="w-96 border-r overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
          {MasterView && masterResource ? (
            <MasterView
              resource={masterResource}
              store={store}
              onSelect={handleSelectEntity}
              onFollowLink={(href: string) => handleFollowLink(href, 'master')}
            />
          ) : (
            <div className="p-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {root ? 'Select a tab' : 'Loading...'}
            </div>
          )}
        </div>

        {/* Detail Pane */}
        <div className="flex-1 overflow-y-auto">
          {DetailViewComponent && detailResource ? (
            <DetailViewComponent
              resource={detailResource}
              store={store}
              onFollowLink={(href: string) => handleFollowLink(href, 'detail')}
            />
          ) : (
            <div className="p-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>
              Select an item
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
