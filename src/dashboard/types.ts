/** Widget types that can be placed on the dashboard */
export type WidgetType = 'link' | 'field' | 'status-summary' | 'submission' | 'streaming' | 'remote-control'

/** A widget placed on the dashboard, referencing a control from an entity's iLayer */
export interface DashboardWidget {
  id: string              // Resource ID for persistence
  position: number
  widgetType: WidgetType
  entity: string          // entity name (noun name)
  field?: string          // field ID within the entity's iLayer
  layer?: string          // layer key (e.g. "customers", "customers-detail")
  targets?: string[]      // IDs of widgets this one controls (Widget targets Widget)
}

/** A section containing widgets */
export interface DashboardSection {
  id: string              // Resource ID for persistence
  title: string
  columnCount: number
  position: number
  widgets: DashboardWidget[]
}

/** Full parsed dashboard config */
export interface DashboardConfig {
  sections: DashboardSection[]
}
