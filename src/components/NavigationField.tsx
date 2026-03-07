import type { ILayerField } from '../types'

/** A field that renders as a tappable navigation link to another layer */
export function NavigationField({ field }: { field: ILayerField }) {
  const address = field.link?.address || ''

  return (
    <div className="mb-4">
      {field.label && (
        <label className="block text-sm font-medium text-muted-foreground mb-1">{field.label}</label>
      )}
      <button
        type="button"
        data-address={address}
        className="w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-card text-card-foreground hover:border-primary-300 dark:hover:border-primary-700 transition-colors text-sm"
      >
        <span>{(field.value as string) || field.placeholder || 'Select...'}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="m9 18 6-6-6-6"/></svg>
      </button>
    </div>
  )
}
