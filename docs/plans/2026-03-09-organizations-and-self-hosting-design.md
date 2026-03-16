# Organizations & Self-Hosting Design

**Goal:** Replace flat `tenant` email string with a proper Organization entity, express GraphDL's metamodel as ingestible readings, and make ui.do a universal app host — the single runtime for graphdl admin, auto.dev support chat, and any domain-model-driven application.

**Vision:** Enterprise-grade apps by "vibe coding without vibe coding." You describe what you want as natural language readings. The domain model guarantees the architectural structure that vibe coding lacks. ui.do renders the generated layers as a complete application — navigation, forms, dashboards, chat, state machines, real-time streaming — with zero hand-written UI code.

**Architecture:** Four interconnected changes: (1) Organization model at the framework level, (2) readings folder as bootstrap seed for GraphDL's own metamodel, (3) ui.do as universal app host replacing both Payload admin and chat.auto.dev, (4) chat/streaming capability so ui.do can host AI-powered support apps.

## 1. Organization Model

### New Entity Type

- **Organization** (reference: OrgSlug)

### New Value Types

- **OrgSlug** (string) — URL-safe identifier
- **OrgRole** (string, enum: `owner`, `member`)

### New Fact Types

```
Organization has Name.
  Each Organization has at most one Name.
User has OrgRole in Organization — UC(User, Organization).
Domain belongs to Organization.
  Each Domain belongs to at most one Organization.
```

Three facts. `Domain belongs to Organization` replaces the flat `tenant` string on Domains and Apps.

### Implicit Personal Organization

Every user gets a personal Organization on first access (slug derived from email, e.g. `lippertz-gmail-com`). Existing domains migrate from `tenant: email` to `belongs to: <personal-org>`.

### Access Control Changes

**Current:** rawProxy checks `domain.tenant === email || domain.visibility === 'public'`

**New:** rawProxy checks "User has any OrgRole in Domain's Organization" OR `domain.visibility === 'public'`

- Read scoping: look up OrgMemberships where `user === email`, get org IDs, filter domains by org
- Write scoping: same membership check (any role can read/write to org domains)
- Owner role: can manage members (invite/remove), delete org
- Member role: can read/write to org domains

### Payload Collections (derived from readings)

**Organizations:**
- `slug` (text, unique, index) — reference scheme
- `name` (text) — Organization has Name

**OrgMemberships** (materializes the ternary):
- `user` (text, index) — email address
- `organization` (relationship to Organizations)
- `role` (select: owner, member)
- Unique compound index on (user, organization) — enforces UC(User, Organization)

**Domains** (modified):
- Replace `tenant: text` with `organization: relationship` to Organizations
- Same for Apps collection

### Migration

1. For each unique `tenant` email, create a personal Organization
2. Update all Domains/Apps to point to their owner's personal Organization
3. Drop `tenant` field after migration

## 2. Readings Folder

A `readings/` folder in graphdl-orm containing the full metamodel as textual readings — the same fact types represented graphically in the NORMA Core diagram (`design/GraphDL.orm`).

### Purpose

- **Bootstrap seed** for creating a "graphdl" domain within graphdl-orm itself
- Fed to the claim extractor (`POST /graphdl/extract/claims`), which creates the domain and all its nouns/readings/constraints
- After bootstrap, the DB is the source of truth — the readings folder is not manually maintained
- The readings generator (`outputFormat='readings'`) can re-export current DB state as textual readings at any time

### Structure

One file per subject area, mirroring the NORMA diagram groupings:
- `readings/core.md` — Noun, Reading, Domain, Graph Schema, Constraint
- `readings/state.md` — State Machine Definition, State Machine, Status, Transition, Event, Guard
- `readings/instances.md` — Resource, ResourceRole, Graph
- `readings/organizations.md` — Organization, OrgMembership (new)
- `readings/ui.md` — Dashboard, Section, Widget, Layer, Generator

### Self-Referential Flow

```
readings/ folder → claim extractor → "graphdl" domain in DB (bootstrap)
                                      ↓
                              ui.do edits via API
                                      ↓
                              DB (source of truth)
                                      ↓
                        readings generator (re-export)
```

The NORMA diagram (`design/Core.png`) becomes a historical artifact. The model evolves through ui.do and can be re-exported as readings from the DB.

## 3. ui.do as Universal App Host

ui.do is not a dashboard renderer — it's the single runtime for any domain-model-driven application. Two immediate hosts:

- **graphdl admin** — manages nouns, readings, domains, organizations (replaces Payload admin UI)
- **auto.dev support** — AI chat with streaming responses, state machine-driven workflows (replaces chat.auto.dev)

Any future app built on GraphDL readings gets a complete UI from ui.do with zero hand-written frontend code.

### Rendering Flow

Each app's domain readings generate iLayers that ui.do renders:

1. Domain readings in DB → iLayer generator → form/navigation/chat layers
2. ui.do renders these layers using the existing control registry
3. Dashboard customization (sections + widgets) provides the layout system
4. CRUD operations hit the API via rawProxy
5. Chat/streaming hits `/ai/chat` or domain-specific agent endpoints

### Reference Architecture: iFactr

ui.do's iLayer concept originates from iFactr (`C:\Users\lippe\Repos\iFactr-Android`), a cross-platform mobile framework. Key patterns to carry forward:

| iFactr concept | ui.do equivalent | Status |
|---|---|---|
| Layer (self-contained screen) | iLayer | Works |
| Navigation Map (URI → Controller) | App routing + state machine transitions | Partial |
| Fieldsets (field grouping) | FormLayer fieldsets | Works |
| Factory/Binding (abstract → native) | converter.ts registry (schema → React) | Works |
| **Master/Detail/Popover panes** | **Three-pane layout** | **Needs implementation** |

### Master/Detail/Popover (Required Pattern)

Three pane types, responsive to viewport:

- **Master** — list/navigation pane (entity list, conversation list, sidebar)
- **Detail** — selected item pane (entity form, active conversation, dashboard)
- **Popover** — modal overlay (relationship pickers, confirmations, quick actions, widget picker)

**Responsive behavior:**
- Phone: panes stack full-screen with back navigation
- Tablet/desktop: master + detail side-by-side, popover as overlay
- Each pane maintains its own navigation history stack

**Navigation targeting:** Links and actions specify which pane to target. A NavigationLayer item in the master pane opens its detail in the detail pane. A "pick relationship" action opens in the popover pane.

ui.do currently has an informal version (sidebar + main content area) but the pane system is not formalized — no popover pane, no per-pane history, no explicit pane targeting.

### Gap Analysis

| Capability | ui.do equivalent | Status |
|---|---|---|
| List view | NavigationLayer + `link` widgets | Works |
| Detail/edit form | FormLayer + `field` widgets | Renders, needs submit |
| Create form | `submission` widget type | Designed, needs wiring |
| Relationship picker | FormLayer field with `relationTo` | Needs component |
| Delete | API call | Trivial |
| Search/filter | NavigationLayer query params | Needs component |
| Master/Detail/Popover | Three-pane layout | Needs implementation |
| Per-pane navigation history | History stack per pane | Needs implementation |

### Key Gaps to Close

1. **Form submission** — ui.do renders forms but doesn't POST/PATCH back to the API yet. The `submission` widget type was designed for this; the actual submit handler needs wiring.

2. **Relationship fields** — when editing a Reading that references a Noun, the form needs a searchable dropdown of available Nouns. This is a new control type in the `converter.ts` registry.

3. **Search/filter** — list views need query parameter support for filtering and sorting.

4. **Chat/streaming** — real-time AI conversation UI. Needs: message history display, text input, streaming response rendering (SSE from `/ai/chat`), conversation persistence. The `streaming` widget type provides the rendering surface; the chat component provides the interaction model.

## 4. Chat & Streaming

### What chat.auto.dev Does Today

- Message list with user/assistant bubbles
- Text input with submit
- Streaming SSE responses from the support agent (`support.auto.dev`)
- Conversation history (stored in state machine events)
- Admin view with conversation list, redraft, constraint management

### How This Maps to ui.do

| chat.auto.dev feature | ui.do equivalent |
|---|---|
| Message list | `streaming` widget rendering conversation events |
| Text input + submit | `submission` widget targeting the chat stream |
| Streaming response | SSE connection to `/ai/chat` or agent endpoint |
| Conversation list | NavigationLayer listing state machine instances |
| Admin redraft | `remote-control` widget targeting the streaming widget |

The `streaming` widget type + `remote-control` + `submission` compose into a full chat interface. Widget-targets-Widget bindings wire them together: submission widget emits user message → streaming widget receives and sends to agent → streaming widget renders response.

### Chat Component

A chat-specific control in the converter registry that combines:
- Scrollable message history (renders conversation events)
- Input area (text + submit button)
- SSE streaming for assistant responses
- State machine integration (each conversation is a state machine instance)

This is registered as a control type so any domain can include chat by adding the right readings — the support domain's readings generate a chat interface, the graphdl domain's readings generate an admin interface, all from the same renderer.

### Migration Path

Gradual takeover: Payload admin and chat.auto.dev stay as fallbacks while ui.do capabilities are built. Once ui.do can host both, the separate apps get retired. The REST API always works as escape hatch.

## Data Flow Summary

```
Organization model
  rawProxy: membership check replaces tenant === email
  Implicit personal org per user

Readings folder (bootstrap seed)
  → claim extractor
  → "graphdl" domain in DB
  → iLayer generator
  → form/nav/chat layers

ui.do (universal app host)
  → renders any domain's iLayers as a complete application
  → CRUD via REST API (forms, submissions)
  → Chat via SSE (streaming, agent conversations)
  → State machines via /state/ endpoints (workflows)
  → DB is source of truth
  → readings generator can re-export

Apps hosted by ui.do:
  graphdl admin  — manage nouns, readings, domains, orgs
  auto.dev support — AI chat, conversation management, admin tools
  any future app — readings in, enterprise app out
```
