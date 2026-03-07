/** Format a noun name for display: split camelCase and capitalize */
export function formatNounName(name: string): string {
  if (!name) return ''
  // Already has spaces — just capitalize each word
  if (name.includes(' ')) return name.replace(/\b\w/g, c => c.toUpperCase())
  // Split camelCase: "InvoiceLineItem" -> "Invoice Line Item"
  const camelSplit = name.replace(/([a-z])([A-Z])/g, '$1 $2')
  if (camelSplit !== name) return camelSplit
  // Single lowercase word — just capitalize
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** Get the best display name for a noun — uses formatted camelCase name */
export function nounDisplayName(noun: { name: string; plural?: string }): string {
  return formatNounName(noun.name)
}

/** Format a domain slug for display: "cost-attribution" -> "Cost Attribution" */
export function formatDomainLabel(d: { title?: string; name?: string; domainSlug?: string; slug?: string; id: string }): string {
  const raw = d.title || d.name || d.domainSlug || d.slug || d.id
  if (raw.includes(' ')) return raw
  return raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
