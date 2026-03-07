import type { ILayerField } from '../../types'

const STATUS_COLORS: Record<string, string> = {
  Received: 'bg-blue-100 text-blue-700 border-blue-200',
  Triaging: 'bg-amber-100 text-amber-700 border-amber-200',
  Investigating: 'bg-green-100 text-green-700 border-green-200',
  WaitingOnCustomer: 'bg-blue-100 text-blue-700 border-blue-200',
  Resolved: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  Closed: 'bg-gray-100 text-gray-500 border-gray-200',
  merged: 'bg-violet-100 text-violet-700 border-violet-200',
}

export function StatusControl({ field }: { field: ILayerField }) {
  const status = (field.value as string) || ''
  return (
    <div className="mb-4">
      {field.label && <label className="block text-sm font-medium text-muted-foreground mb-1">{field.label}</label>}
      <span className={`inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[status] || STATUS_COLORS.Closed}`}>
        {status}
      </span>
    </div>
  )
}
