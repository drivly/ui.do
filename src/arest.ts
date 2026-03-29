/**
 * AREST client — follows _links to navigate the application.
 *
 * The engine returns hypermedia representations. The client renders them.
 * Navigation is link-following, not route-matching.
 * Actions are transition links, not hardcoded buttons.
 *
 * Every response has:
 *   - Entity fields (the representation)
 *   - _links (navigation + transitions)
 *
 * A query IS a partially applied fact: bind some roles, get the free roles.
 */

function getApiUrl() {
  if (typeof window === 'undefined') return 'https://api.auto.dev'
  return new URLSearchParams(window.location.search).get('api') || 'https://api.auto.dev'
}
const API_URL = getApiUrl()

export interface ArestLink {
  href: string
  method?: string
}

export interface ArestEntity {
  id: string
  type: string
  version?: number
  createdAt?: string
  updatedAt?: string
  _links?: Record<string, ArestLink>
  [field: string]: unknown
}

export interface ArestListResult {
  docs: ArestEntity[]
  totalDocs: number
  limit: number
  page: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
  _links?: Record<string, string>
}

export interface ArestCommandResult {
  entities: Array<{ id: string; type: string; data: Record<string, string> }>
  status: string | null
  transitions: Array<{ event: string; targetStatus: string; method: string; href: string }>
  violations: Array<{ constraintId: string; constraintText: string; detail: string }>
  rejected: boolean
}

// ── Core: follow a link ─────────────────────────────────────────────

async function followLink(link: ArestLink | string, body?: unknown): Promise<Response> {
  const href = typeof link === 'string' ? link : link.href
  const method = typeof link === 'string' ? 'GET' : (link.method || 'GET')
  const url = href.startsWith('http') ? href : `${API_URL}${href}`

  return fetch(url, {
    method,
    credentials: 'include',
    redirect: 'manual',
    headers: {
      'Accept': 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

// ── Resource operations ─────────────────────────────────────────────

/** GET a single entity by following its self link or by noun/id. */
export async function getEntity(nounOrLink: string | ArestLink, id?: string, domain?: string): Promise<ArestEntity | null> {
  let link: ArestLink | string
  if (typeof nounOrLink === 'object') {
    link = nounOrLink
  } else if (id) {
    const qs = domain ? `?domain=${domain}` : ''
    link = `/api/entities/${encodeURIComponent(nounOrLink)}/${id}${qs}`
  } else {
    return null
  }

  const res = await followLink(link)
  if (!res.ok) return null
  return res.json()
}

/** GET a collection of entities. */
export async function listEntities(noun: string, domain: string, opts?: { page?: number; limit?: number }): Promise<ArestListResult> {
  const params = new URLSearchParams()
  params.set('domain', domain)
  if (opts?.page) params.set('page', String(opts.page))
  if (opts?.limit) params.set('limit', String(opts.limit))

  const res = await followLink(`/api/entities/${encodeURIComponent(noun)}?${params}`)
  if (!res.ok) throw new Error(`Failed to list ${noun}: ${res.status}`)
  return res.json()
}

/** Follow a transition link (POST). */
export async function fireTransition(link: ArestLink, event: string): Promise<ArestCommandResult> {
  const res = await followLink(link, { event })
  if (!res.ok) throw new Error(`Transition failed: ${res.status}`)
  return res.json()
}

/** Create an entity via POST. */
export async function createEntity(noun: string, domain: string, data: Record<string, unknown>): Promise<ArestEntity> {
  const res = await followLink({
    href: `/api/entities/${encodeURIComponent(noun)}?domain=${domain}`,
    method: 'POST',
  }, { type: noun, domain, data })
  if (!res.ok) throw new Error(`Create failed: ${res.status}`)
  return res.json()
}

/** PATCH an entity. */
export async function patchEntity(link: ArestLink | string, data: Record<string, unknown>): Promise<ArestEntity> {
  const href = typeof link === 'string' ? link : link.href
  const res = await followLink({ href, method: 'PATCH' }, data)
  if (!res.ok) throw new Error(`Patch failed: ${res.status}`)
  return res.json()
}

/** DELETE an entity. */
export async function deleteEntity(link: ArestLink | string): Promise<void> {
  const href = typeof link === 'string' ? link : link.href
  await followLink({ href, method: 'DELETE' })
}

// ── Query: partial application ──────────────────────────────────────

export interface QueryResult {
  schema: string
  target: string
  bindings: Record<string, string>
  matches: string[]
  count: number
  derived: number
}

/** Query a fact type by partially applying bindings. */
export async function queryFacts(
  schema: string,
  domain: string,
  bindings: Record<string, string>,
  target: string,
): Promise<QueryResult> {
  const params = new URLSearchParams()
  params.set('domain', domain)
  params.set('target', target)
  for (const [noun, value] of Object.entries(bindings)) {
    params.set(`bind[${noun}]`, value)
  }

  const res = await followLink(`/api/facts/${encodeURIComponent(schema)}?${params}`)
  if (!res.ok) throw new Error(`Query failed: ${res.status}`)
  return res.json()
}

// ── Link helpers ────────────────────────────────────────────────────

/** Extract transition links from an entity's _links (non-navigation links with method POST). */
export function getTransitionLinks(entity: ArestEntity): Array<{ event: string; link: ArestLink }> {
  if (!entity._links) return []
  return Object.entries(entity._links)
    .filter(([key, link]) => link.method === 'POST' && key !== 'self' && key !== 'collection')
    .map(([event, link]) => ({ event, link }))
}

/** Extract navigation links (GET links). */
export function getNavigationLinks(entity: ArestEntity): Record<string, string> {
  if (!entity._links) return {}
  const nav: Record<string, string> = {}
  for (const [key, link] of Object.entries(entity._links)) {
    if (!link.method || link.method === 'GET') {
      nav[key] = link.href
    }
  }
  return nav
}

/** Get the fields (non-system, non-link properties) from an entity. */
export function getEntityFields(entity: ArestEntity): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (key.startsWith('_') || ['id', 'type', 'version', 'createdAt', 'updatedAt'].includes(key)) continue
    fields[key] = value
  }
  return fields
}

// ── App picker data ─────────────────────────────────────────────────
// These fetch from the AREST engine's entity endpoints.
// The same data that the old Payload API served at /graphdl/raw/*
// is now at /api/entities/:noun.

/** Fetch all Apps from the engine. */
export async function fetchArestApps(): Promise<ArestEntity[]> {
  try {
    const res = await followLink('/api/entities/App?domain=organizations&limit=100')
    if (!res.ok) return []
    const data = await res.json()
    return data.docs || []
  } catch { return [] }
}

/** Fetch all Domains from the engine. */
export async function fetchArestDomains(): Promise<ArestEntity[]> {
  try {
    const res = await followLink('/api/entities/Domain?domain=organizations&limit=500')
    if (!res.ok) return []
    const data = await res.json()
    return data.docs || []
  } catch { return [] }
}

/** Fetch entity Nouns for a domain. */
export async function fetchArestNouns(domainSlug: string): Promise<ArestEntity[]> {
  try {
    const res = await followLink(`/api/entities/Noun?domain=${domainSlug}&limit=500`)
    if (!res.ok) return []
    const data = await res.json()
    // Filter to entity types only
    return (data.docs || []).filter((n: ArestEntity) => n.objectType === 'entity')
  } catch { return [] }
}

/** Fetch Organizations from the engine. */
export async function fetchArestOrganizations(): Promise<ArestEntity[]> {
  try {
    const res = await followLink('/api/entities/Organization?domain=organizations&limit=100')
    if (!res.ok) return []
    const data = await res.json()
    return data.docs || []
  } catch { return [] }
}
