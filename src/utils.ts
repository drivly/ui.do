/** Format a noun name for display: split camelCase and capitalize */
export function formatNounName(name: string): string {
  // Already has spaces — just capitalize first letter
  if (name.includes(' ')) return name.charAt(0).toUpperCase() + name.slice(1)
  // Split camelCase: "SupportRequest" -> "Support Request"
  // Split concatenated lowercase: "supportrequests" -> try camelCase first
  const camelSplit = name.replace(/([a-z])([A-Z])/g, '$1 $2')
  if (camelSplit !== name) return camelSplit
  // Already lowercase single word — just capitalize
  return name.charAt(0).toUpperCase() + name.slice(1)
}
