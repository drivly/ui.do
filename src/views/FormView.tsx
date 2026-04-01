import { useState } from 'react'
import type { Resource, Store } from '../rho/store'

interface FormViewProps {
  resource: Resource
  store: Store
  onFollowLink: (href: string) => void
}

export default function FormView({ resource, store }: FormViewProps) {
  const schema = resource._schema
  const fields = schema?.fields || []
  const createLink = resource._links?.create

  const [values, setValues] = useState<Record<string, string>>({})

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!createLink) return
    try {
      const res = await fetch(createLink.href, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: values }),
      })
      if (res.ok) {
        const selfHref = resource._links?.self?.href
        if (selfHref) store.followLink(selfHref)
      }
    } catch (e) {
      console.error('Create failed:', e)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-medium mb-4">New {resource.type}</h2>
      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        {fields.map((field: any) => (
          <div key={field.name}>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted-foreground)' }}>
              {field.name} {field.required && <span style={{ color: 'var(--destructive)' }}>*</span>}
            </label>
            <input
              type="text"
              value={values[field.name] || ''}
              onChange={e => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
              className="w-full px-2 py-1.5 text-sm rounded border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
            />
          </div>
        ))}
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="text-xs px-3 py-1.5 rounded"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  )
}
