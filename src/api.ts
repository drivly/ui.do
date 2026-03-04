const API_URL = new URLSearchParams(window.location.search).get('api') || 'https://api.auto.dev'
const API_KEY = new URLSearchParams(window.location.search).get('key') || ''

export async function fetchLayers(domain?: string): Promise<Record<string, any>> {
  const params = new URLSearchParams()
  params.set('where[outputFormat][equals]', 'ilayer')
  if (domain) params.set('where[domain][equals]', domain)
  params.set('depth', '0')
  params.set('limit', '1')
  params.set('sort', '-createdAt')

  const res = await fetch(`${API_URL}/graphdl/raw/generators?${params}`, {
    headers: { 'X-API-Key': API_KEY },
  })

  if (!res.ok) throw new Error(`Failed to fetch layers: ${res.status}`)
  const data = await res.json()
  const gen = data.docs?.[0]
  if (!gen?.output?.files) throw new Error('No ilayer generator found')

  // Parse all layer files
  const layers: Record<string, any> = {}
  for (const [key, value] of Object.entries(gen.output.files)) {
    if (key.startsWith('layers/') && key.endsWith('.json')) {
      const name = key.replace('layers/', '').replace('.json', '')
      layers[name] = typeof value === 'string' ? JSON.parse(value) : value
    }
  }
  return layers
}

export async function sendStateEvent(machineType: string, instanceId: string, event: string) {
  const res = await fetch(`${API_URL}/state/${machineType}/${instanceId}/${event}`, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  return res.json()
}
