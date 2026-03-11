const API_URL = new URLSearchParams(window.location.search).get('api') || 'https://api.auto.dev'
const AUTH_URL = 'https://auto.dev/signin'

export function redirectToLogin() {
  window.location.href = `${AUTH_URL}?redirectUrl=${encodeURIComponent(window.location.href)}`
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    redirect: 'manual',
    headers: {
      ...init?.headers,
      'Accept': 'application/json',
    },
  })

  if (res.status === 401 || res.type === 'opaqueredirect' || res.status === 0) {
    throw new Error('Unauthorized')
  }

  return res
}

export interface Session {
  email: string
  plan?: string
  admin?: boolean
}

export async function fetchSession(): Promise<Session | null> {
  try {
    const res = await fetch(`${API_URL}/account`, {
      credentials: 'include',
      redirect: 'manual',
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok || res.type === 'opaqueredirect' || res.status === 0) return null
    const data = await res.json()
    return {
      email: data.user?.email || data.email || '',
      plan: data.user?.plan || data.plan || '',
      admin: data.user?.admin || data.admin || false,
    }
  } catch {
    return null
  }
}

export interface Organization {
  id: string
  name: string
  slug?: string
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const res = await apiFetch('/graphdl/raw/organizations?depth=0&pagination=false')
  if (!res.ok) return []
  const data = await res.json()
  return data.docs || []
}

export interface AppRecord {
  id: string
  name: string
  slug: string
  organization?: string | Organization
  visibility?: string
  description?: string
  domains?: string[] | Domain[]
  navigableDomains?: string[]  // domain IDs that render tabs; empty/missing = all
  chatEndpoint?: string  // if set, overboard renders chat instead of noun grid
}

export async function fetchApps(): Promise<AppRecord[]> {
  const res = await apiFetch('/graphdl/raw/apps?depth=1&pagination=false')
  if (!res.ok) throw new Error('Failed to fetch apps')
  const data = await res.json()
  const docs = data.docs || data
  if (!Array.isArray(docs)) return []
  return docs.map((app: any) => {
    // Parse description as JSON config if possible
    if (app.description && typeof app.description === 'string') {
      try {
        const config = JSON.parse(app.description)
        if (config.chatEndpoint) app.chatEndpoint = config.chatEndpoint
        if (config.navigableDomains) app.navigableDomains = config.navigableDomains
      } catch { /* not JSON, ignore */ }
    }
    // Convention: apps with "support" in slug get chat overboard with support tab only
    if (!app.chatEndpoint && app.slug?.includes('support')) {
      app.chatEndpoint = '/graphdl/chat'
      const supportDomain = (app.domains || []).find((d: any) =>
        typeof d === 'object' && d.domainSlug?.endsWith('-support')
      )
      if (supportDomain) app.navigableDomains = [supportDomain.id]
    }
    return app
  })
}

export interface Domain {
  id: string
  slug?: string
  domainSlug?: string
  title?: string
  name?: string
  organization?: string | Organization
}

export async function fetchDomains(): Promise<Domain[]> {
  const res = await apiFetch('/graphdl/raw/domains?depth=0&pagination=false')
  if (!res.ok) throw new Error('Failed to fetch domains')
  const data = await res.json()
  const docs = data.docs || data
  return Array.isArray(docs) ? docs : []
}

export interface Noun {
  id: string
  name: string
  objectType: 'entity' | 'value'
  plural?: string
  domain?: string | { id: string; slug?: string }
}

export async function fetchNouns(domainId: string): Promise<Noun[]> {
  const params = new URLSearchParams()
  params.set('where[domain][equals]', domainId)
  params.set('where[objectType][equals]', 'entity')
  params.set('depth', '0')
  params.set('pagination', 'false')
  const res = await apiFetch(`/graphdl/raw/nouns?${params}`)
  if (!res.ok) throw new Error('Failed to fetch nouns')
  const data = await res.json()
  return data.docs || []
}

export interface Reading {
  id: string
  text: string
  domain?: string | { id: string; slug?: string }
  graphSchema?: string | { id: string; title?: string }
}

export async function fetchReadings(domainId: string): Promise<Reading[]> {
  const params = new URLSearchParams()
  params.set('where[domain][equals]', domainId)
  params.set('depth', '0')
  params.set('pagination', 'false')
  const res = await apiFetch(`/graphdl/raw/readings?${params}`)
  if (!res.ok) throw new Error('Failed to fetch readings')
  const data = await res.json()
  return data.docs || []
}

export interface Constraint {
  id: string
  title?: string
  kind: string
  modality: 'Alethic' | 'Deontic'
}

export async function fetchConstraints(domainId: string): Promise<Constraint[]> {
  const params = new URLSearchParams()
  params.set('where[domain][equals]', domainId)
  params.set('depth', '1')
  params.set('pagination', 'false')
  const res = await apiFetch(`/graphdl/raw/constraints?${params}`)
  if (!res.ok) throw new Error('Failed to fetch constraints')
  const data = await res.json()
  return data.docs || []
}

export interface GraphInstance {
  id: string
  title: string
  type?: string | { id: string; title?: string }
  domain?: string | { id: string }
}

export async function fetchGraphs(domainId: string): Promise<GraphInstance[]> {
  const params = new URLSearchParams()
  params.set('where[domain][equals]', domainId)
  params.set('depth', '1')
  params.set('pagination', 'false')
  const res = await apiFetch(`/graphdl/raw/graphs?${params}`)
  if (!res.ok) return [] // gracefully return empty if graphs endpoint unavailable
  const data = await res.json()
  return data.docs || []
}

export async function fetchLayers(domain?: string): Promise<Record<string, any>> {
  const params = new URLSearchParams()
  params.set('where[outputFormat][equals]', 'ilayer')
  if (domain) params.set('where[domain.domainSlug][equals]', domain)
  params.set('depth', '0')
  params.set('limit', '1')
  params.set('sort', '-createdAt')

  const res = await apiFetch(`/graphdl/raw/generators?${params}`)
  if (!res.ok) throw new Error(`Failed to fetch layers: ${res.status}`)
  const data = await res.json()
  const gen = data.docs?.[0]
  if (!gen?.output) throw new Error('No ilayer generator found')

  // output may be a JSON string (graphdl-orm SQLite) or a parsed object (Payload)
  const output = typeof gen.output === 'string' ? JSON.parse(gen.output) : gen.output
  if (!output?.files) throw new Error('No ilayer generator found')

  const layers: Record<string, any> = {}
  for (const [key, value] of Object.entries(output.files)) {
    if (key.startsWith('layers/') && key.endsWith('.json')) {
      const name = key.replace('layers/', '').replace('.json', '')
      layers[name] = typeof value === 'string' ? JSON.parse(value) : value
    }
  }
  return layers
}

export async function bootstrapApp(slug: string, claims: any) {
  const res = await apiFetch('/graphdl/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, claims }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || `Bootstrap failed: ${res.status}`)
  }
  return res.json()
}

export interface Resource {
  id: string
  title?: string
  type?: string | { id: string; name?: string }
  value?: string
  domain?: string | { id: string }
}

/** Fetch the Dashboard noun for a domain, if one exists */
export async function fetchDashboardNoun(domainId: string): Promise<Noun | null> {
  const params = new URLSearchParams()
  params.set('where[domain][equals]', domainId)
  params.set('where[name][equals]', 'Dashboard')
  params.set('depth', '0')
  params.set('limit', '1')
  const res = await apiFetch(`/graphdl/raw/nouns?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.docs?.[0] || null
}

/** Fetch dashboard preference resources for the current user */
export async function fetchDashboardPrefs(domainId: string, dashboardNounId: string): Promise<Resource[]> {
  const params = new URLSearchParams()
  params.set('where[domain][equals]', domainId)
  params.set('where[type][equals]', dashboardNounId)
  params.set('depth', '0')
  params.set('pagination', 'false')
  const res = await apiFetch(`/graphdl/raw/resources?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.docs || []
}

/** Write a dashboard preference as a resource instance fact */
export async function writeDashboardPref(domainId: string, dashboardNounId: string, value: string): Promise<Resource> {
  const res = await apiFetch('/graphdl/raw/resources', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: dashboardNounId, value, domain: domainId }),
  })
  if (!res.ok) throw new Error(`Failed to write dashboard pref: ${res.status}`)
  const data = await res.json()
  return data.doc
}

/** Delete a dashboard preference resource */
export async function deleteDashboardPref(id: string): Promise<void> {
  const res = await apiFetch(`/graphdl/raw/resources/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete dashboard pref: ${res.status}`)
}

/** Update a dashboard config fact's value */
export async function updateDashboardFact(id: string, value: string): Promise<Resource> {
  const res = await apiFetch(`/graphdl/raw/resources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`Failed to update dashboard fact: ${res.status}`)
  const data = await res.json()
  return data.doc
}

export async function deleteApp(appId: string): Promise<void> {
  const res = await apiFetch(`/graphdl/raw/apps/${appId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete app: ${res.status}`)
}

export async function extractClaims(text: string): Promise<any> {
  const res = await apiFetch('/graphdl/extract/claims', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `Extraction failed: ${res.status}`)
  }
  return res.json()
}

export async function sendStateEvent(machineType: string, instanceId: string, event: string) {
  const res = await apiFetch(`/state/${machineType}/${instanceId}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}

/**
 * Send a chat message and stream the response via fetch ReadableStream.
 * Calls the support agent or /ai/chat endpoint.
 */
export async function streamChat(
  endpoint: string,
  body: Record<string, unknown>,
  onChunk: (text: string) => void,
  onDone: (fullResponse: any) => void,
  onError: (error: Error) => void,
): Promise<void> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`Chat request failed: ${res.status}`)
    }

    const contentType = res.headers.get('content-type') || ''
    const isSSE = contentType.includes('text/event-stream')

    if (!isSSE) {
      // Non-streaming JSON response — extract content directly
      const data = await res.json()
      if (data.content) onChunk(typeof data.content === 'string' ? data.content : JSON.stringify(data.content))
      onDone(data)
      return
    }

    const reader = res.body?.getReader()
    if (!reader) {
      onDone({})
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            onDone({})
            return
          }
          try {
            const parsed = JSON.parse(data)
            if (parsed.content) onChunk(parsed.content)
            if (parsed.done) onDone(parsed)
          } catch {
            onChunk(data)
          }
        }
      }
    }

    onDone({})
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)))
  }
}
