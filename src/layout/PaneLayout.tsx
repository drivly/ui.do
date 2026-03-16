import { type ReactNode } from 'react'
import type { LayoutState } from './types'

interface PaneLayoutProps {
  layout: LayoutState
  hideMaster?: boolean
  renderMaster: () => ReactNode
  renderDetail: () => ReactNode
  renderPopover?: () => ReactNode
  onClosePopover: () => void
}

export function PaneLayout({
  layout,
  hideMaster,
  renderMaster,
  renderDetail,
  renderPopover,
  onClosePopover,
}: PaneLayoutProps) {
  const hasDetail = layout.detail.current !== null
  const hasPopover = layout.popover !== null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Master pane — always mounted, hidden via CSS to prevent unmount flicker */}
      <div className={`
        ${hideMaster ? 'hidden' : hasDetail ? 'hidden md:flex' : 'flex'}
        flex-col w-full md:w-80 lg:w-96 border-r border-border shrink-0 overflow-hidden
      `}>
        {renderMaster()}
      </div>

      {/* Detail pane */}
      {hasDetail && (
        <div className="flex flex-col flex-1 min-w-0">
          {renderDetail()}
        </div>
      )}

      {/* Popover pane */}
      {hasPopover && renderPopover && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClosePopover}
          />
          <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto m-4">
            {renderPopover()}
          </div>
        </div>
      )}
    </div>
  )
}
