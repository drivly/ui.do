import { useState } from 'react'
import type { IMenu } from '../types'

interface Props {
  menu: IMenu
  onNavigate?: (address: string) => void
}

export function Menu({ menu, onNavigate }: Props) {
  const [open, setOpen] = useState(false)

  if (!menu.buttons.length) return null

  return (
    <div className="relative mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted text-muted-foreground rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        {menu.title || 'Menu'}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-10 min-w-48 bg-card border border-border rounded-lg shadow-lg py-1">
          {menu.buttons.map(btn => (
            <button
              key={btn.id}
              onClick={() => {
                setOpen(false)
                if (btn.link?.address) onNavigate?.(btn.link.address)
              }}
              className="block w-full text-left px-4 py-2 text-sm text-card-foreground hover:bg-muted transition-colors"
            >
              {btn.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
