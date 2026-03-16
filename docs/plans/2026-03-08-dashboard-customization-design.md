# Dashboard Customization Design

**Goal:** Dashboard is a composable control surface where admins place any control from any entity's iLayer — links, field displays, status summaries, submission forms, streaming updates, and remote-control widgets.

**Architecture:** Section-based layout. Sections contain widgets. Each widget references a control from an entity's generated iLayer and renders it using the existing control registry. Widget-to-widget bindings enable reactive dashboards.

## Domain Model (Readings)

New readings in the UI domain:

```
Dashboard has Section.
  Each Section belongs to at most one Dashboard.
Section has Title.
  Each Section has at most one Title.
Section has ColumnCount.
  Each Section has at most one ColumnCount.
Section has Position.
  Each Section has at most one Position.
Section has Widget.
  Each Widget belongs to at most one Section.
Widget has Position.
  Each Widget has at most one Position.
Widget has WidgetType.
  Each Widget has at most one WidgetType.
Widget references Entity.
  Each Widget references at most one Entity.
Widget references Field.
  Each Widget references at most one Field.
Widget references Layer.
  Each Widget references at most one Layer.
Widget targets Widget.
  Each Widget targets each Widget at most once.
```

**WidgetType** is a value type with enum: `link, field, status-summary, submission, streaming, remote-control`

### Key Modeling Decisions

- **Widget references a control, not raw data.** Each widget points to an entity + field + layer from the iLayer system. The renderer looks up that entity's generated layer, finds the field, and renders it using the existing `converter.ts` registry. No new rendering code per widget type.
- **Remote control:** "Widget targets Widget" creates a reactive binding — when the source widget emits a value, the target widget receives it as input. Uses the existing state machine event system for transport.
- **Instance facts for config:** Dashboard layout is stored as instance facts (Resources), following the existing pin/hide pattern. Admin sets defaults, users can override.

## Widget Types

| Type | Description | Renders as |
|------|-------------|-----------|
| link | Navigates to entity list/detail | Navigation card (existing NavigationField) |
| field | Displays a specific field value from an entity instance | Any field control from converter.ts registry |
| status-summary | Shows counts/aggregates by status | Status badges with counts |
| submission | Inline form to create a new entity instance | FormLayer fields subset |
| streaming | Real-time feed of recent changes | Live-updating list |
| remote-control | Emits values that control another widget | Any input control + Widget targets Widget binding |

## Rendering Flow

1. Fetch dashboard instance facts (Resources) for the domain's Dashboard noun
2. Parse into sections → widgets structure
3. For each widget: fetch the referenced entity's iLayer, extract the referenced field/control
4. Render using existing `LayerRenderer` / field registry
5. Wire up Widget-targets-Widget bindings as event subscriptions

## Edit Mode (Inline)

Extends existing "Edit Dashboard" toggle:

- **Add Section** button → creates Section instance fact with title + position
- **Within section:** "Add Widget" → entity picker → field/control picker (reads from that entity's iLayer)
- **Drag handles** for reorder (updates Position instance facts)
- **Delete** per widget and section
- **Widget wiring:** select source widget → "Link to" → select target widget (creates Widget targets Widget fact)
- **Save** writes instance facts to `/graphdl/raw/resources`

## Data Flow

### Save
1. Edit mode changes → POST instance facts to `/graphdl/raw/resources`
2. No regeneration needed — dashboard config is instance-level

### Render
1. Fetch dashboard instance facts for domain
2. Parse into section/widget tree
3. For each widget: resolve entity iLayer → extract field definition
4. Render via existing control registry
5. Subscribe to Widget-targets-Widget bindings

## Access Control

- Admin: full edit (add/remove sections, widgets, wiring)
- User: pin/hide/reorder (existing preference system overlays admin layout)
- Instance facts are domain-scoped and user-scoped via existing rawProxy tenant filtering
