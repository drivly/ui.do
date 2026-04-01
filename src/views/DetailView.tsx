import { useState } from 'react'
import type { Resource, Store } from '../rho/store'

interface DetailViewProps {
  resource: Resource
  store: Store
  onFollowLink: (href: string) => void
}

export default function DetailView({ resource, store, onFollowLink }: DetailViewProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const data = resource.data || {}
  const links = resource._links || {}

  const navLinks = Object.entries(links).filter(([k, v]: [string, any]) => k !== 'self' && !v.method)
  const transitionLinks = Object.entries(links).filter(([k, v]: [string, any]) => v.method === 'POST' && k !== 'create')

  const fields = Object.entries(data).filter(([k]) => !k.startsWith('_'))

  async function handleTransition(event: string, href: string) {
    try {
      await fetch(href, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
      })
      const selfHref = links.self?.href
      if (selfHref) store.followLink(selfHref)
    } catch (e) {
      console.error('Transition failed:', e)
    }
    setMenuOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div>
          <span className="text-sm font-medium">{resource.type}</span>
          <span className="ml-2 text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{resource.id}</span>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-xs px-2 py-1 rounded"
            style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
          >
            Actions
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-8 z-10 min-w-48 rounded-md p-1 shadow-lg"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <button className="w-full text-left text-xs px-3 py-1.5 rounded hover:opacity-80" style={{ color: 'var(--foreground)' }}>
                Edit
              </button>
              <button className="w-full text-left text-xs px-3 py-1.5 rounded hover:opacity-80" style={{ color: 'var(--destructive)' }}>
                Delete
              </button>
              {transitionLinks.length > 0 && (
                <>
                  <div className="my-1 border-t" style={{ borderColor: 'var(--border)' }} />
                  <div className="px-3 py-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>Transitions</div>
                  {transitionLinks.map(([event, link]: [string, any]) => (
                    <button
                      key={event}
                      onClick={() => handleTransition(event, link.href)}
                      className="w-full text-left text-xs px-3 py-1.5 rounded hover:opacity-80"
                      style={{ color: 'var(--accent)' }}
                    >
                      {event}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <dl className="space-y-3">
          {fields.map(([key, value]) => (
            <div key={key}>
              <dt className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{key}</dt>
              <dd className="text-sm mt-0.5">{String(value)}</dd>
            </div>
          ))}
        </dl>

        {navLinks.length > 0 && (
          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs mb-2" style={{ color: 'var(--muted-foreground)' }}>Related</div>
            <div className="flex flex-wrap gap-2">
              {navLinks.map(([key, link]: [string, any]) => (
                <button
                  key={key}
                  onClick={() => onFollowLink(link.href)}
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  {key}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
