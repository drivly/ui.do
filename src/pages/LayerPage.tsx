import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { fetchLayers, sendStateEvent } from '../api'
import { FormLayer } from '../components/FormLayer'
import { NavigationLayer } from '../components/NavigationLayer'
import { defaultRegistry } from '../components/converter'
import type { ILayer, IActionButton } from '../types'

export function LayerPage({ layerName: defaultName }: { layerName?: string }) {
  const { layerName } = useParams()
  const name = layerName || defaultName || 'index'
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<any>(null)

  const [searchParams] = useSearchParams()
  const domain = searchParams.get('domain') || undefined
  const qs = domain ? `?domain=${domain}` : ''

  useEffect(() => {
    fetchLayers(domain).then(setLayers).catch(e => setError(e.message))
  }, [domain])

  if (error) return <div className="max-w-2xl mx-auto p-4 bg-red-50 rounded-lg text-red-700">{error}</div>
  if (!layers) return <div className="max-w-2xl mx-auto text-gray-500">Loading...</div>

  const layer = layers[name]
  if (!layer) return (
    <div className="max-w-2xl mx-auto">
      <p className="text-gray-500">Layer "{name}" not found.</p>
      <Link to={`/${qs}`} className="text-blue-600 hover:underline mt-2 inline-block">Back to index</Link>
    </div>
  )

  const handleAction = async (btn: IActionButton) => {
    if (btn.address) {
      const parts = btn.address.split('/')
      const machineType = parts[2]
      const event = parts[3]
      const instanceId = prompt(`Enter ${machineType} instance ID:`)
      if (!instanceId) return
      const result = await sendStateEvent(machineType, instanceId, event)
      setActionResult(result)
    }
  }

  return (
    <div>
      {name !== 'index' && (
        <div className="max-w-2xl mx-auto mb-4">
          <Link to={`/${qs}`} className="text-blue-600 hover:underline text-sm">Back to index</Link>
        </div>
      )}
      {layer.type === 'formLayer'
        ? <FormLayer layer={layer as any} registry={defaultRegistry} onAction={handleAction} />
        : <NavigationLayer layer={layer as any} registry={defaultRegistry} onAction={handleAction} />}
      {actionResult && (
        <div className="max-w-2xl mx-auto mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
          <pre className="text-sm text-green-800">{JSON.stringify(actionResult, null, 2)}</pre>
          <button onClick={() => setActionResult(null)} className="text-green-600 text-sm mt-2 hover:underline">Dismiss</button>
        </div>
      )}
    </div>
  )
}
