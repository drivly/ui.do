import type { Resource, Store } from '../rho/store'

interface ListViewProps {
  resource: Resource
  store: Store
  onSelect: (href: string) => void
  onFollowLink: (href: string) => void
}

export default function ListView({ resource, store, onSelect, onFollowLink }: ListViewProps) {
  const docs = resource.docs || []
  const schema = resource._schema
  const links = resource._links || {}
  const fields = schema?.fields?.filter((f: any) => f.role === 'attribute') || []

  const columns = fields.length > 0
    ? fields.map((f: any) => f.name)
    : docs.length > 0
      ? Object.keys(docs[0].data || docs[0]).filter(k => !k.startsWith('_') && k !== 'id' && k !== 'type' && k !== 'data')
      : []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-medium">{resource.type} ({resource.totalDocs ?? docs.length})</span>
        {links.create && (
          <button
            onClick={() => onFollowLink(links.create.href)}
            className="text-xs px-2 py-1 rounded"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            + New
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {docs.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: 'var(--muted-foreground)' }}>No items</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
                <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>ID</th>
                {columns.map(col => (
                  <th key={col} className="text-left px-4 py-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => {
                const selfLink = doc._links?.self?.href || ''
                const cellData = doc.data || doc
                return (
                  <tr
                    key={doc.id}
                    onClick={() => selfLink && onSelect(selfLink)}
                    className="border-b cursor-pointer transition-colors hover:opacity-80"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-2 font-mono" style={{ color: 'var(--accent)' }}>{doc.id}</td>
                    {columns.map(col => (
                      <td key={col} className="px-4 py-2">{String((cellData as any)[col] ?? (cellData as any)[col.toLowerCase()] ?? '')}</td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {Object.entries(links).filter(([k, v]: [string, any]) => k !== 'self' && k !== 'create' && !v.method).length > 0 && (
        <div className="px-4 py-2 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
          {Object.entries(links)
            .filter(([k, v]: [string, any]) => k !== 'self' && k !== 'create' && !v.method)
            .map(([key, link]: [string, any]) => (
              <button
                key={key}
                onClick={() => onFollowLink(link.href)}
                className="text-xs px-2 py-1 rounded"
                style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
              >
                {key}
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
