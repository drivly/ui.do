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
  slug: string
  title?: string
  tenant?: string
}

export async function fetchDomains(): Promise<Domain[]> {
  const res = await apiFetch('/graphdl/domains')
  if (!res.ok) throw new Error('Failed to fetch domains')
  const data = await res.json()
  return data.docs || data || []
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

export async function sendStateEvent(machineType: string, instanceId: string, event: string) {
  const res = await apiFetch(`/state/${machineType}/${instanceId}/${event}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return res.json()
}
