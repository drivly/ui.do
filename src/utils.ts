/**
 * Parse a state machine address like /state/{machineType}/{instanceId}/{event}
 * Returns null if the address doesn't match the pattern.
 */
export function parseStateAddress(address: string): { machineType: string; instanceId: string; event: string } | null {
  const path = address.replace(/^\//, '')
  if (!path.startsWith('state/')) return null
  const segments = path.split('/')
  if (segments.length !== 4) return null
  return { machineType: segments[1], instanceId: segments[2], event: segments[3] }
}

/** Format a noun name for display: split camelCase and capitalize */
export function formatNounName(name: string): string {
  if (!name) return ''
  // Split each word's camelCase, then rejoin
  // "New SupportRequest" -> "New" + "SupportRequest" -> "New" + "Support Request" -> "New Support Request"
  return name.split(/\s+/).map(word => {
    const split = word.replace(/([a-z])([A-Z])/g, '$1 $2')
    return split.charAt(0).toUpperCase() + split.slice(1)
  }).join(' ')
}

/** Get the best display name for a noun — uses formatted camelCase name */
export function nounDisplayName(noun: { name: string; plural?: string }): string {
  return formatNounName(noun.name)
}

/** Format a domain slug for display: "cost-attribution" -> "Cost Attribution" */
const domainLabelOverrides: Record<string, string> = {
  support: 'Requests',
}

export function formatDomainLabel(d: { title?: string; name?: string; domainSlug?: string; slug?: string; id: string }): string {
  const raw = d.title || d.name || d.domainSlug || d.slug || d.id
  const key = raw.toLowerCase()
  if (domainLabelOverrides[key]) return domainLabelOverrides[key]
  if (raw.includes(' ')) return raw
  return raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
