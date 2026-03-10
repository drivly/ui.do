# Chat Support App Design

## Goal

Replace chat.auto.dev with a native ui.do app. The support agent uses the full Universe of Discourse (all 14 business domains) to answer questions without hallucinating.

## App Structure

Multi-domain app containing all 14 business domains. UI surfaces two things:

1. **Overboard** — full-screen chat (ChatStreamControl)
2. **Support Requests** — single visible domain tab, master/detail

## Domain Tab Visibility

App-level config controls which domains render tabs. New field on AppRecord: `navigableDomains` (array of domain IDs). Only those domains get header tabs. If empty/missing, all domains are navigable (backward compatible).

For this app: only the support domain is navigable. The other 13 domains exist for agent context.

## Overboard: Chat View

- New `ChatOverboardView` component replaces the noun-grid `OverboardView` when a custom overboard is configured
- Full-width ChatStreamControl calling the support agent endpoint
- No domain cards, no entity counts — just the conversation
- Detection: if the app has a `chatEndpoint` field or if there's a streaming-capable domain, render chat overboard instead of noun grid

## Support Requests Tab: Master/Detail

- **Master pane:** Request list, role-aware per readings
  - Customers: `where[customer][equals]={currentUserId}` — own requests only
  - Admins: all requests with status filters (Escalated, Open, Resolved)
- **Detail pane:** Conversation history via ChatControl + state machine action buttons for admins (resolve, reopen, redraft, reply)
- Rendered via iLayer — the support domain's generated layers drive the layout

## Implementation Scope

### What exists already
- `ChatStreamControl` — live streaming chat UI with SSE
- `ChatControl` — read-only conversation history viewer
- `streamChat()` API — endpoint-agnostic streaming fetch
- `PaneLayout` — master/detail pane system
- `OverboardView` — multi-domain landing (to be conditionally replaced)
- Support domain readings + state machine definitions in graphdl-orm

### What needs building

1. **App-level navigableDomains** — filter domain tabs in App.tsx header
2. **ChatOverboardView** — new component wrapping ChatStreamControl full-width
3. **Overboard routing** — detect when to show chat vs noun grid
4. **SupportRequestsListView** — master pane with role-aware filtering
5. **SupportRequestDetailView** — detail pane with chat history + admin actions
6. **Create the app** — seed the multi-domain app via API with all 14 domains, navigableDomains=[support]

## Out of Scope

- Backend agent changes (support.auto.dev worker stays as-is for now)
- Constraint verification loop changes
- New domain readings
