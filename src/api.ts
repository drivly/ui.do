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
    // Chat config comes from the app record (appType, chatEndpoint)
    if (app.appType === 'chat' && !app.navigableDomains) {
      // For chat apps, default to showing only the support domain
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

/** Fetch entity instances from 3NF tables, with state machine statuses */
export async function fetchEntityInstances(domainId: string, nounName: string): Promise<{
  resources: Array<{ id: string; reference?: string; value?: string; createdAt?: string; [key: string]: any }>
  statuses: Map<string, string>
}> {
  // Query 3NF table and state machines in parallel
  const smParams = new URLSearchParams()
  smParams.set('where[domain][equals]', domainId)
  smParams.set('depth', '1')
  smParams.set('pagination', 'false')

  const [entityRes, smResponse] = await Promise.all([
    apiFetch(`/graphdl/entities/${nounName}?domain=${domainId}&sort=-createdAt&limit=1000`),
    apiFetch(`/graphdl/raw/state-machines?${smParams}`),
  ])

  const resources = entityRes.ok ? (await entityRes.json()).docs || [] : []

  const statuses = new Map<string, string>()
  if (smResponse.ok) {
    const smData = await smResponse.json()
    for (const sm of smData.docs || []) {
      // State machines link to entities by name (resource ID) or resource FK
      const resourceId = typeof sm.resource === 'string' ? sm.resource : sm.resource?.id
      const name = sm.name // state machine name = entity ID
      const statusName = typeof sm.stateMachineStatus === 'object' ? sm.stateMachineStatus?.name
        : typeof sm.currentStatus === 'object' ? sm.currentStatus?.name : ''
      if (statusName) {
        if (resourceId) statuses.set(resourceId, statusName)
        if (name && name !== resourceId) statuses.set(name, statusName)
      }
    }
  }

  return { resources, statuses }
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

/** Fetch messages for a support request from the 3NF messages table */
export async function fetchRequestMessages(domainId: string, requestId: string): Promise<Array<{ role: string; content: string; timestamp?: string }>> {
  // Query both Message and SupportResponse entities for this request
  // Role is derived from entity type: Message = user, SupportResponse = assistant
  const [msgRes, respRes] = await Promise.all([
    apiFetch(`/graphdl/entities/Message?domain=${domainId}&where[supportRequestId][equals]=${requestId}&sort=createdAt&limit=1000`),
    apiFetch(`/graphdl/entities/SupportResponse?domain=${domainId}&where[supportRequestId][equals]=${requestId}&sort=createdAt&limit=1000`),
  ])

  const messages: Array<{ role: string; content: string; timestamp?: string }> = []

  if (msgRes.ok) {
    const data = await msgRes.json()
    for (const doc of data.docs || []) {
      const content = doc.body || doc.content || ''
      if (content) messages.push({ role: 'user', content, timestamp: doc.sentAt || doc.createdAt })
    }
  }

  if (respRes.ok) {
    const data = await respRes.json()
    for (const doc of data.docs || []) {
      const content = doc.body || doc.content || ''
      if (content) messages.push({ role: 'assistant', content, timestamp: doc.sentAt || doc.createdAt })
    }
  }

  if (messages.length > 0) {
    // Sort by timestamp to interleave user and assistant messages correctly
    messages.sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''))
    return messages
  }

  // Fallback: legacy resources table (for messages created before 3NF migration)
  const nounParams = new URLSearchParams()
  nounParams.set('where[domain][equals]', domainId)
  nounParams.set('where[name][equals]', 'Message')
  nounParams.set('depth', '0')
  nounParams.set('limit', '1')
  const nounRes = await apiFetch(`/graphdl/raw/nouns?${nounParams}`)
  if (!nounRes.ok) return []
  const nounData = await nounRes.json()
  const noun = nounData.docs?.[0]
  if (!noun) return []

  const params = new URLSearchParams()
  params.set('where[noun][equals]', noun.id)
  params.set('where[domain][equals]', domainId)
  params.set('where[reference][equals]', requestId)
  params.set('depth', '0')
  params.set('pagination', 'false')
  params.set('sort', 'createdAt')
  const legacyRes = await apiFetch(`/graphdl/raw/resources?${params}`)
  if (!legacyRes.ok) return []
  const legacyData = await legacyRes.json()
  return (legacyData.docs || []).map((doc: any) => {
    try {
      const parsed = JSON.parse(doc.value)
      if (parsed.role && parsed.content) return parsed
      return null
    } catch { return null }
  }).filter(Boolean)
}

/** Fetch a single entity by ID — tries 3NF tables, falls back to resources */
export async function fetchResource(id: string, domainId?: string, nounName?: string): Promise<{ id: string; reference?: string; value?: string; [key: string]: any } | null> {
  // Try 3NF table if noun name is known
  if (domainId && nounName) {
    try {
      const res = await apiFetch(`/graphdl/entities/${nounName}/${id}?domain=${domainId}`)
      if (res.ok) return res.json()
    } catch { /* fall through */ }
  }
  // Fallback to generic resources
  try {
    const res = await apiFetch(`/graphdl/raw/resources/${id}?depth=0`)
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

/** Create a new reading (constraint or fact) in a domain */
export async function createReading(domainId: string, text: string): Promise<Reading> {
  const res = await apiFetch('/graphdl/raw/readings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, domain: domainId }),
  })
  if (!res.ok) throw new Error(`Failed to create reading: ${res.status}`)
  const data = await res.json()
  return data.doc
}

export async function sendStateEvent(machineType: string, instanceId: string, event: string) {
  const res = await apiFetch(`/state/${machineType}/${instanceId}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}

export async function fetchRequestState(machineType: string, instanceId: string): Promise<{
  currentState?: string
  availableEvents?: string[]
} | null> {
  try {
    const res = await apiFetch(`/state/${machineType}/${instanceId}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
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
