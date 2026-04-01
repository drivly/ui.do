import { describe, it, expect, vi } from 'vitest'
import { createStore } from './store'

describe('createStore', () => {
  it('starts with no resources', () => {
    const store = createStore()
    expect(store.getResource('/arest/')).toBeUndefined()
  })

  it('stores resources by href after followLink', async () => {
    const store = createStore()
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        type: 'User',
        id: 'samuel@driv.ly',
        _links: { self: { href: '/arest/' } },
      }),
    }))
    global.fetch = mockFetch as any

    await store.followLink('/arest/')
    const resource = store.getResource('/arest/')
    expect(resource?.type).toBe('User')
  })

  it('notifies subscribers on resource update', async () => {
    const store = createStore()
    const listener = vi.fn()
    store.subscribe(listener)

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: 'User', id: 'test', _links: {} }),
    })) as any

    await store.followLink('/arest/')
    expect(listener).toHaveBeenCalled()
  })

  it('getSnapshot returns incrementing version', async () => {
    const store = createStore()
    const v1 = store.getSnapshot()

    global.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ type: 'User', id: 'test', _links: {} }),
    })) as any

    await store.followLink('/arest/')
    const v2 = store.getSnapshot()
    expect(v2).toBeGreaterThan(v1)
  })

  it('registers and resolves DEFS by type', () => {
    const store = createStore()
    const MockComponent = () => null
    store.registerDef('collection', MockComponent)
    expect(store.resolveDef('collection')).toBe(MockComponent)
  })

  it('resolves noun-specific DEFS before generic', () => {
    const store = createStore()
    const Generic = () => null
    const Specific = () => null
    store.registerDef('entity', Generic)
    store.registerDef('Support Request', Specific)
    expect(store.resolveDef('Support Request')).toBe(Specific)
    expect(store.resolveDef('Organization')).toBe(Generic)
  })
})
