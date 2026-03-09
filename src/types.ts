/**
 * iLayer Type System — aligned with iFactr IElement reference architecture.
 *
 * Hierarchy:
 *   IElement (layout positioning)
 *     └── IControl (interactive, SubmitKey, Validate)
 *           ├── IField variants (text, email, numeric, bool, date, time, select, etc.)
 *           ├── IButton
 *           └── ILabel
 *
 *   iLayer (domain model)
 *     ├── IFormLayer  → Fieldsets → Fields
 *     └── INavigationLayer → ListItems → NavigationItems
 */

// ---------------------------------------------------------------------------
// Link & Metadata
// ---------------------------------------------------------------------------

/** Navigation link with address and optional metadata (matches iFactr Link) */
export interface ILink {
  address: string
  parameters?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validation rule attached to a field */
export interface IValidationRule {
  type: 'required' | 'expression' | 'numeric' | 'custom'
  expression?: string
  message: string
}

// ---------------------------------------------------------------------------
// Element & Control (layout primitives)
// ---------------------------------------------------------------------------

/** Grid positioning for elements within a cell or fieldset */
export interface IElementLayout {
  columnIndex?: number
  columnSpan?: number
  rowIndex?: number
  rowSpan?: number
  horizontalAlignment?: 'left' | 'center' | 'right' | 'stretch'
  verticalAlignment?: 'top' | 'center' | 'bottom' | 'stretch'
}

// ---------------------------------------------------------------------------
// Fields (Form Controls)
// ---------------------------------------------------------------------------

/** All supported field types — union discriminated by `type` */
export type FieldType =
  | 'text'
  | 'email'
  | 'numeric'
  | 'password'
  | 'multiline'
  | 'bool'
  | 'date'
  | 'time'
  | 'select'
  | 'slider'
  | 'label'
  | 'navigation'
  | 'button'
  | 'image'
  // Extended controls (ui.do specific, rendered via converter)
  | 'chat'
  | 'chat-stream'
  | 'markdown'
  | 'status'

export interface ILayerField {
  id: string
  label: string
  type: FieldType
  placeholder?: string
  required?: boolean
  /** Regex validation expression (matches iFactr Field.Expression) */
  expression?: string
  /** Validation rules — evaluated in order */
  validationRules?: IValidationRule[]
  /** Current validation errors */
  brokenRules?: string[]
  /** Form submission key (defaults to id if omitted) */
  submitKey?: string

  // Value
  value?: string | number | boolean | unknown

  // Select-specific
  options?: string[]
  selectedIndex?: number

  // Slider-specific
  minValue?: number
  maxValue?: number

  // Navigation/Button-specific
  link?: ILink

  // Image-specific
  imagePath?: string
  stretch?: 'fill' | 'uniform' | 'none'

  // Layout positioning within fieldset grid
  layout?: IElementLayout
}

// ---------------------------------------------------------------------------
// Fieldset
// ---------------------------------------------------------------------------

export interface IFieldset {
  header?: string
  footer?: string
  layout?: 'List' | 'Simple'
  fields: ILayerField[]
}

// ---------------------------------------------------------------------------
// Action Buttons
// ---------------------------------------------------------------------------

export interface IActionButton {
  id: string
  text: string
  action?: string
  /** Navigation address on click */
  address?: string
  /** Rich link with parameters */
  link?: ILink
  /** Image/icon path */
  imagePath?: string
}

// ---------------------------------------------------------------------------
// Navigation Items & Lists
// ---------------------------------------------------------------------------

export interface INavigationItem {
  text: string
  subtext?: string
  address?: string
  link?: ILink
  status?: string
  /** Image/icon path */
  imagePath?: string
  /** Accessory link (e.g., disclosure indicator target) */
  accessoryLink?: ILink
  onClick?: () => void
}

export interface IListItem {
  type: 'list'
  header?: string
  footer?: string
  displayStyle?: string
  items: INavigationItem[]
}

// ---------------------------------------------------------------------------
// Menu & Toolbar (matches iFactr IMenu/IToolbar)
// ---------------------------------------------------------------------------

export interface IMenuButton {
  id: string
  title: string
  imagePath?: string
  link?: ILink
}

export interface IMenu {
  title?: string
  imagePath?: string
  buttons: IMenuButton[]
}

export interface IToolbarItem {
  type: 'button' | 'separator'
  id?: string
  title?: string
  imagePath?: string
  link?: ILink
}

export interface IToolbar {
  primaryItems?: IToolbarItem[]
  secondaryItems?: IToolbarItem[]
}

// ---------------------------------------------------------------------------
// Search Box (matches iFactr ISearchBox)
// ---------------------------------------------------------------------------

export interface ISearchBox {
  placeholder?: string
  text?: string
}

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

export interface IFormLayer {
  name: string
  title: string
  type: 'formLayer'
  layout?: string
  fieldsets: IFieldset[]
  actionButtons?: IActionButton[]
  navigation?: INavigationItem[]
  menu?: IMenu
  toolbar?: IToolbar
  /** Action parameters submitted with the form */
  actionParameters?: Record<string, string>
}

export interface INavigationLayer {
  name: string
  title: string
  type: 'layer'
  layout?: string
  items: IListItem[]
  actionButtons?: IActionButton[]
  menu?: IMenu
  toolbar?: IToolbar
  searchBox?: ISearchBox
}

export type ILayer = IFormLayer | INavigationLayer

// ---------------------------------------------------------------------------
// Converter Registry
// ---------------------------------------------------------------------------

export type ControlComponent = React.ComponentType<{ field: ILayerField }>
export type ConverterRegistry = Record<string, ControlComponent>
