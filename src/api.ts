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

export interface Domain {
  id: string
  slug?: string
  domainSlug?: string
  title?: string
  name?: string
  tenant?: string
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
  if (!gen?.output?.files) throw new Error('No ilayer generator found')

  const layers: Record<string, any> = {}
  for (const [key, value] of Object.entries(gen.output.files)) {
    if (key.startsWith('layers/') && key.endsWith('.json')) {
      const name = key.replace('layers/', '').replace('.json', '')
      layers[name] = typeof value === 'string' ? JSON.parse(value) : value
    }
  }
  return layers
}

export async function bootstrapApp(slug: string, readings: { text: string; multiplicity?: string }[]) {
  const res = await apiFetch('/graphdl/bootstrap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, readings }),
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

export async function sendStateEvent(machineType: string, instanceId: string, event: string) {
  const res = await apiFetch(`/state/${machineType}/${instanceId}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}
