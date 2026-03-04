export interface ILayerField {
  id: string
  label: string
  type: 'text' | 'email' | 'numeric' | 'bool' | 'date' | 'select' | 'multiline' | 'slider' | 'label' | 'password'
  placeholder?: string
  required?: boolean
  options?: string[]  // for select fields
  value?: string | number | boolean
}

export interface IFieldset {
  header?: string
  footer?: string
  layout?: 'List' | 'Simple'
  fields: ILayerField[]
}

export interface IActionButton {
  id: string
  text: string
  action?: string
  address?: string
}

export interface INavigationItem {
  text: string
  subtext?: string
  address?: string
  link?: { address: string }
}

export interface IListItem {
  type: 'list'
  displayStyle?: string
  items: INavigationItem[]
}

export interface IFormLayer {
  name: string
  title: string
  type: 'formLayer'
  layout?: string
  fieldsets: IFieldset[]
  actionButtons?: IActionButton[]
  navigation?: INavigationItem[]
}

export interface INavigationLayer {
  name: string
  title: string
  type: 'layer'
  layout?: string
  items: IListItem[]
}

export type ILayer = IFormLayer | INavigationLayer
