export type PaneType = 'master' | 'detail' | 'popover'

export interface PaneState {
  stack: string[]       // navigation history (addresses/view keys)
  current: string | null
}

export interface LayoutState {
  master: PaneState
  detail: PaneState
  popover: PaneState | null  // null = closed
}

export type PaneTarget = PaneType | 'auto'
