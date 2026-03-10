import type { Resource } from '../api.ts'
import type { DashboardConfig, DashboardSection, DashboardWidget, WidgetType } from './types.ts'

// ---------------------------------------------------------------------------
// Parsing regexes
// ---------------------------------------------------------------------------

/** section <title> at <position> cols <columnCount> */
const SECTION_RE = /^section\s+(.+?)\s+at\s+(\d+)(?:\s+cols\s+(\d+))?$/

/** widget <widgetType> <entity> [<field>] [layer:<layer>] in <sectionTitle> at <position> */
const WIDGET_RE = /^widget\s+([\w-]+)\s+(\S+?)(?:\s+((?!layer:)\S+?))?(?:\s+layer:(\S+?))?\s+in\s+(.+?)\s+at\s+(\d+)$/

/** targets <sourceWidgetId> -> <targetWidgetId> */
const TARGET_RE = /^targets\s+(\S+)\s+->\s+(\S+)$/

// ---------------------------------------------------------------------------
// Parsed intermediates (before assembly)
// ---------------------------------------------------------------------------

interface ParsedSection {
  id: string
  title: string
  position: number
  columnCount: number
}

interface ParsedWidget {
  id: string
  widgetType: WidgetType
  entity: string
  field?: string
  layer?: string
  sectionTitle: string
  position: number
}

interface ParsedTarget {
  sourceId: string
  targetId: string
}

// ---------------------------------------------------------------------------
// Valid widget types for runtime validation
// ---------------------------------------------------------------------------

const VALID_WIDGET_TYPES = new Set<string>([
  'link', 'field', 'status-summary', 'submission', 'streaming', 'remote-control',
])

function isWidgetType(s: string): s is WidgetType {
  return VALID_WIDGET_TYPES.has(s)
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse Resource instance facts into a DashboardConfig.
 *
 * Each Resource whose `value` matches one of the three fact formats
 * (section, widget, targeting) contributes to the config. Resources with
 * missing, empty, or unrecognised values are silently skipped.
 */
export function parseDashboardConfig(resources: Resource[]): DashboardConfig {
  const sections: ParsedSection[] = []
  const widgets: ParsedWidget[] = []
  const targets: ParsedTarget[] = []

  for (const res of resources) {
    const val = res.value?.trim()
    if (!val) continue

    let m: RegExpMatchArray | null

    // Try section
    m = val.match(SECTION_RE)
    if (m) {
      sections.push({
        id: res.id,
        title: m[1],
        position: Number(m[2]),
        columnCount: Number(m[3] || '3'),
      })
      continue
    }

    // Try widget
    m = val.match(WIDGET_RE)
    if (m) {
      const widgetType = m[1]
      if (!isWidgetType(widgetType)) continue // unknown widget type — skip

      const parsed: ParsedWidget = {
        id: res.id,
        widgetType,
        entity: m[2],
        sectionTitle: m[5],
        position: Number(m[6]),
      }

      // m[3] is the optional <field> capture — but we need to distinguish
      // between an actual field and a "layer:..." token that ended up in
      // this capture group. The regex is already structured so that
      // layer:xxx goes to m[4], so m[3] is always a field if present.
      if (m[3]) parsed.field = m[3]
      if (m[4]) parsed.layer = m[4]

      widgets.push(parsed)
      continue
    }

    // Try target
    m = val.match(TARGET_RE)
    if (m) {
      targets.push({ sourceId: m[1], targetId: m[2] })
      continue
    }

    // Unrecognised value — skip silently
  }

  // Build a map from widget ID to target IDs
  const targetMap = new Map<string, string[]>()
  for (const t of targets) {
    const list = targetMap.get(t.sourceId)
    if (list) {
      list.push(t.targetId)
    } else {
      targetMap.set(t.sourceId, [t.targetId])
    }
  }

  // Convert parsed widgets to DashboardWidget objects and group by section title
  const widgetsBySection = new Map<string, DashboardWidget[]>()
  for (const pw of widgets) {
    const dw: DashboardWidget = {
      id: pw.id,
      position: pw.position,
      widgetType: pw.widgetType,
      entity: pw.entity,
    }
    if (pw.field) dw.field = pw.field
    if (pw.layer) dw.layer = pw.layer
    const tgts = targetMap.get(pw.id)
    if (tgts && tgts.length > 0) dw.targets = tgts

    const list = widgetsBySection.get(pw.sectionTitle)
    if (list) {
      list.push(dw)
    } else {
      widgetsBySection.set(pw.sectionTitle, [dw])
    }
  }

  // Assemble sections with their widgets, sorted by position
  const assembledSections: DashboardSection[] = sections
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const sectionWidgets = widgetsBySection.get(s.title) || []
      sectionWidgets.sort((a, b) => a.position - b.position)
      return {
        id: s.id,
        title: s.title,
        columnCount: s.columnCount,
        position: s.position,
        widgets: sectionWidgets,
      }
    })

  return { sections: assembledSections }
}

// ---------------------------------------------------------------------------
// Serializers — produce fact value strings from structured data
// ---------------------------------------------------------------------------

/** Serialize a section fact value */
export function serializeSection(title: string, position: number, columnCount: number): string {
  return `section ${title} at ${position} cols ${columnCount}`
}

/** Serialize a widget fact value */
export function serializeWidget(
  widgetType: WidgetType,
  entity: string,
  sectionTitle: string,
  position: number,
  field?: string,
  layer?: string,
): string {
  let s = `widget ${widgetType} ${entity}`
  if (field) s += ` ${field}`
  if (layer) s += ` layer:${layer}`
  s += ` in ${sectionTitle} at ${position}`
  return s
}

/** Serialize a targeting fact value */
export function serializeTarget(sourceId: string, targetId: string): string {
  return `targets ${sourceId} -> ${targetId}`
}
