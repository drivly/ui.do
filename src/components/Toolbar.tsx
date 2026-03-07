import type { IToolbar } from '../types'

interface Props {
  toolbar: IToolbar
  onNavigate?: (address: string) => void
}

export function Toolbar({ toolbar, onNavigate }: Props) {
  const items = [...(toolbar.primaryItems || []), ...(toolbar.secondaryItems || [])]
  if (!items.length) return null

  return (
    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
      {toolbar.primaryItems?.map((item, i) => (
        item.type === 'separator' ? (
          <div key={i} className="w-px h-5 bg-border" />
        ) : (
          <button
            key={i}
            onClick={() => item.link?.address && onNavigate?.(item.link.address)}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            {item.title}
          </button>
        )
      ))}
      {toolbar.secondaryItems?.length ? (
        <>
          <div className="flex-1" />
          {toolbar.secondaryItems.map((item, i) => (
            item.type === 'separator' ? (
              <div key={`s${i}`} className="w-px h-5 bg-border" />
            ) : (
              <button
                key={`s${i}`}
                onClick={() => item.link?.address && onNavigate?.(item.link.address)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.title}
              </button>
            )
          ))}
        </>
      ) : null}
    </div>
  )
}
