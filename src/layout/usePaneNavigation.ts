import { useState, useCallback } from 'react'
import type { LayoutState, PaneType } from './types'

const INITIAL_STATE: LayoutState = {
  master: { stack: [], current: null },
  detail: { stack: [], current: null },
  popover: null,
}

export function usePaneNavigation() {
  const [layout, setLayout] = useState<LayoutState>(INITIAL_STATE)

  const navigate = useCallback((address: string, target: PaneType = 'detail') => {
    setLayout(prev => {
      if (target === 'popover') {
        return {
          ...prev,
          popover: {
            stack: prev.popover ? [...prev.popover.stack, prev.popover.current!] : [],
            current: address,
          },
        }
      }
      const pane = prev[target]
      return {
        ...prev,
        [target]: {
          stack: pane.current ? [...pane.stack, pane.current] : pane.stack,
          current: address,
        },
      }
    })
  }, [])

  const goBack = useCallback((pane: PaneType) => {
    setLayout(prev => {
      if (pane === 'popover') {
        if (!prev.popover || prev.popover.stack.length === 0) {
          return { ...prev, popover: null }
        }
        const stack = [...prev.popover.stack]
        const current = stack.pop()!
        return { ...prev, popover: { stack, current } }
      }
      const p = prev[pane]
      if (p.stack.length === 0) return prev
      const stack = [...p.stack]
      const current = stack.pop()!
      return { ...prev, [pane]: { stack, current } }
    })
  }, [])

  const closePopover = useCallback(() => {
    setLayout(prev => ({ ...prev, popover: null }))
  }, [])

  return { layout, navigate, goBack, closePopover }
}
