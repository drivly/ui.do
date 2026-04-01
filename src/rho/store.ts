import type { ComponentType } from 'react'

export interface Resource {
  type: string
  id?: string
  data?: Record<string, unknown>
  docs?: Resource[]
  totalDocs?: number
  _links?: Record<string, any>
  _schema?: { fields: any[]; constraints: any[] }
}

export interface Store {
  followLink(href: string): Promise<Resource>
  getResource(href: string): Resource | undefined
  subscribe(callback: () => void): () => void
  getSnapshot(): number
  registerDef(type: string, component: ComponentType<any>): void
  resolveDef(type: string): ComponentType<any> | undefined
  applyEvent(event: { factType: string; entityId: string; data: any }): void
}

/**
 * WASM-backed store for the browser runtime.
 *
 * DEFS holds component registrations (render functions).
 * Resources are cached by href.
 * subscribe/getSnapshot implement the useSyncExternalStore contract.
 * When a resource changes (via followLink or SSE event), subscribers fire.
 */
export function createStore(): Store {
  const resources = new Map<string, Resource>()
  const defs = new Map<string, ComponentType<any>>()
  const listeners = new Set<() => void>()
  let version = 0

  function notify() {
    version++
    listeners.forEach(fn => fn())
  }

  return {
    async followLink(href: string): Promise<Resource> {
      const res = await fetch(href, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      })
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const resource = await res.json() as Resource
      resources.set(href, resource)
      notify()
      return resource
    },

    getResource(href: string): Resource | undefined {
      return resources.get(href)
    },

    subscribe(callback: () => void): () => void {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },

    getSnapshot(): number {
      return version
    },

    registerDef(type: string, component: ComponentType<any>): void {
      defs.set(type, component)
    },

    resolveDef(type: string): ComponentType<any> | undefined {
      return defs.get(type) || defs.get('entity') || undefined
    },

    applyEvent(event: { factType: string; entityId: string; data: any }): void {
      resources.forEach((resource, href) => {
        if (resource.id === event.entityId) {
          resources.set(href, { ...resource, data: { ...resource.data, ...event.data } })
        }
        if (resource.docs) {
          const idx = resource.docs.findIndex(d => d.id === event.entityId)
          if (idx >= 0) {
            const updatedDocs = [...resource.docs]
            updatedDocs[idx] = { ...updatedDocs[idx], data: { ...updatedDocs[idx].data, ...event.data } }
            resources.set(href, { ...resource, docs: updatedDocs })
          }
        }
      })
      notify()
    },
  }
}
