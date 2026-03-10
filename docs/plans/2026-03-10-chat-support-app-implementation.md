# Chat Support App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace chat.auto.dev with a native ui.do app — full-screen chat overboard + support requests master/detail.

**Architecture:** Multi-domain app with all business domains for agent context. App-level `navigableDomains` field filters which domains show tabs. Custom `ChatOverboardView` replaces the noun grid. Support domain gets its own master/detail view driven by iLayer.

**Tech Stack:** React 19, Tailwind 4, existing ChatStreamControl/ChatControl, PaneLayout, graphdl-orm REST API.

---

### Task 1: Add `navigableDomains` to AppRecord and filter domain tabs

**Files:**
- Modify: `src/api.ts:64-72` (AppRecord interface)
- Modify: `src/App.tsx:398-411` (domain tabs rendering)

**Step 1: Add field to AppRecord interface**

In `src/api.ts`, add `navigableDomains` to AppRecord:

```typescript
export interface AppRecord {
  id: string
  name: string
  slug: string
  organization?: string | Organization
  visibility?: string
  description?: string
  domains?: string[] | Domain[]
  navigableDomains?: string[]  // domain IDs that render tabs; empty/missing = all
}
```

**Step 2: Compute navigable domains in App.tsx**

After `appDomains` useMemo (around line 192), add:

```typescript
const navDomains = useMemo(() => {
  if (!selectedApp?.navigableDomains?.length) return appDomains
  return appDomains.filter(d => selectedApp.navigableDomains!.includes(d.id))
}, [selectedApp, appDomains])
```

**Step 3: Replace `appDomains` with `navDomains` in domain tabs only**

In the header domain tabs section (line 399), change:

```typescript
// Before:
{selectedApp && appDomains.length > 1 && appDomains.map(d => (

// After:
{selectedApp && navDomains.length > 0 && navDomains.map(d => (
```

Note: Keep using `appDomains` everywhere else (overboard check, etc.) — only the tabs filter.

**Step 4: Build and verify**

Run: `yarn build`
Expected: Clean build, no type errors.

**Step 5: Commit**

```bash
git add src/api.ts src/App.tsx
git commit -m "feat: add navigableDomains to filter domain tabs"
```

---

### Task 2: Create ChatOverboardView component

**Files:**
- Create: `src/pages/ChatOverboardView.tsx`

**Step 1: Create the component**

```tsx
import { ChatStreamControl } from '../components/controls/ChatStreamControl'
import type { ILayerField } from '../types'

interface Props {
  appName: string
  endpoint?: string
}

export function ChatOverboardView({ appName, endpoint }: Props) {
  const field: ILayerField = {
    id: 'chat-overboard',
    label: appName,
    type: 'chat-stream',
    placeholder: `Ask anything about ${appName}...`,
    link: endpoint ? { address: endpoint } : undefined,
  }

  return (
    <div className="flex flex-col h-full">
      <ChatStreamControl field={field} />
    </div>
  )
}
```

This wraps ChatStreamControl full-height with a synthetic field. The endpoint defaults to `/ai/chat` inside ChatStreamControl if not provided.

**Step 2: Build and verify**

Run: `yarn build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/pages/ChatOverboardView.tsx
git commit -m "feat: add ChatOverboardView component"
```

---

### Task 3: Route overboard to ChatOverboardView for chat-enabled apps

**Files:**
- Modify: `src/api.ts:64-72` (AppRecord interface — add chatEndpoint)
- Modify: `src/App.tsx:471-477` (overboard rendering)

**Step 1: Add chatEndpoint to AppRecord**

In `src/api.ts`:

```typescript
export interface AppRecord {
  id: string
  name: string
  slug: string
  organization?: string | Organization
  visibility?: string
  description?: string
  domains?: string[] | Domain[]
  navigableDomains?: string[]
  chatEndpoint?: string  // if set, overboard renders chat instead of noun grid
}
```

**Step 2: Import ChatOverboardView in App.tsx**

Add to imports:

```typescript
import { ChatOverboardView } from './pages/ChatOverboardView'
```

**Step 3: Update overboard rendering**

Replace the OverboardView block (around line 471):

```typescript
{view.type === 'dashboard' && !selectedDomainId && selectedApp && appDomains.length > 1 && (
  selectedApp.chatEndpoint ? (
    <ChatOverboardView
      appName={formatAppLabel(selectedApp)}
      endpoint={selectedApp.chatEndpoint}
    />
  ) : (
    <OverboardView
      domains={appDomains}
      appName={formatAppLabel(selectedApp)}
      onSelectDomain={handleSelectDomain}
      onNavigate={setView}
    />
  )
)}
```

**Step 4: Remove padding from main when showing chat overboard**

The `<main>` wrapper has `p-6` which adds unwanted padding around the full-height chat. Conditionally remove it:

```typescript
<main className={`flex-1 overflow-y-auto ${
  view.type === 'dashboard' && !selectedDomainId && selectedApp?.chatEndpoint
    ? '' : 'p-6'
}`}>
```

**Step 5: Build and verify**

Run: `yarn build`
Expected: Clean build.

**Step 6: Commit**

```bash
git add src/api.ts src/App.tsx
git commit -m "feat: route overboard to chat for apps with chatEndpoint"
```

---

### Task 4: Create the support app via API

**Files:**
- None (API calls only)

This task creates the actual app record with all 14 domains, `navigableDomains` pointing to support, and `chatEndpoint` pointing to the support agent.

**Step 1: Fetch all domain IDs**

```bash
curl -s -b cookies.txt "https://api.auto.dev/graphdl/raw/domains?depth=0&pagination=false" | jq '[.docs[] | {id, slug: .domainSlug}]'
```

**Step 2: Find the support domain ID**

From the output, identify the support domain's ID.

**Step 3: Create the app**

```bash
curl -s -b cookies.txt -X POST "https://api.auto.dev/graphdl/raw/apps" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Chat",
    "slug": "support-chat",
    "domains": ["<all 14 domain IDs>"],
    "navigableDomains": ["<support domain ID>"],
    "chatEndpoint": "/ai/chat"
  }'
```

Note: The exact endpoint may need to be `/chat` (pointing to support.auto.dev) or whatever the support agent listens on. Verify with the running support worker.

**Step 4: Verify in ui.do**

Open ui.do, select the "Support Chat" app. Verify:
- Overboard shows ChatStreamControl (not noun grid)
- Only the Support domain tab appears in the header
- Clicking the Support tab shows the domain dashboard

**Step 5: Deploy**

```bash
yarn build && npx wrangler pages deploy dist --project-name=ui-do --branch=main
```

---

### Task 5: Build SupportRequestsListView (master pane)

**Files:**
- Create: `src/pages/SupportRequestsListView.tsx`

**Step 1: Create the master list component**

This component fetches support requests and renders a filterable list. Role-aware: customers see own requests, admins see all with filters.

```tsx
import { useState, useEffect } from 'react'
import { type Domain } from '../api'

interface SupportRequest {
  id: string
  title?: string
  value?: string
  createdAt?: string
  updatedAt?: string
}

interface Props {
  domain: Domain
  isAdmin: boolean
  selectedId: string | null
  onSelect: (id: string) => void
}

type Filter = 'all' | 'open' | 'escalated' | 'resolved'

export function SupportRequestsListView({ domain, isAdmin, selectedId, onSelect }: Props) {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    // Fetch resources of type SupportRequest for this domain
    const params = new URLSearchParams()
    params.set('where[domain][equals]', domain.id)
    params.set('depth', '1')
    params.set('pagination', 'false')
    params.set('sort', '-createdAt')

    fetch(`${new URLSearchParams(window.location.search).get('api') || 'https://api.auto.dev'}/graphdl/raw/resources?${params}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(data => setRequests(data.docs || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false))
  }, [domain.id])

  if (loading) return <div className="p-4 text-muted-foreground">Loading requests...</div>

  return (
    <div className="flex flex-col h-full">
      {/* Filters — admin only */}
      {isAdmin && (
        <div className="px-3 pt-3 pb-1 flex gap-1 flex-wrap">
          {(['all', 'open', 'escalated', 'resolved'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors capitalize ${
                f === filter
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Request list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {requests.length === 0 && (
          <div className="text-sm text-muted-foreground py-4 text-center">No support requests</div>
        )}
        {requests.map(req => (
          <button
            key={req.id}
            onClick={() => onSelect(req.id)}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
              req.id === selectedId
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            }`}
          >
            <div className="text-sm font-medium text-foreground truncate">
              {req.title || req.value || req.id}
            </div>
            {req.createdAt && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(req.createdAt).toLocaleDateString()}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
```

Note: This is a starting point — the exact query shape depends on how SupportRequest resources are stored in graphdl-orm. The component should be refined once we verify the actual data shape.

**Step 2: Build and verify**

Run: `yarn build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/pages/SupportRequestsListView.tsx
git commit -m "feat: add SupportRequestsListView master pane"
```

---

### Task 6: Build SupportRequestDetailView (detail pane)

**Files:**
- Create: `src/pages/SupportRequestDetailView.tsx`

**Step 1: Create the detail component**

Shows conversation history via ChatControl and admin action buttons.

```tsx
import { useState, useEffect } from 'react'
import { ChatControl } from '../components/controls/ChatControl'
import { sendStateEvent } from '../api'
import type { ILayerField } from '../types'

interface Props {
  requestId: string
  isAdmin: boolean
}

export function SupportRequestDetailView({ requestId, isAdmin }: Props) {
  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const api = new URLSearchParams(window.location.search).get('api') || 'https://api.auto.dev'
    fetch(`${api}/graphdl/raw/resources/${requestId}?depth=1`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
      .then(r => r.json())
      .then(data => setRequest(data.doc || data))
      .catch(() => setRequest(null))
      .finally(() => setLoading(false))
  }, [requestId])

  if (loading) return <div className="p-6 text-muted-foreground">Loading...</div>
  if (!request) return <div className="p-6 text-muted-foreground">Request not found</div>

  // Build a synthetic chat field from the request's messages
  const chatField: ILayerField = {
    id: `chat-${requestId}`,
    label: request.title || 'Support Request',
    type: 'chat',
    value: request.messages || request.value || [],
  }

  const handleAction = async (event: string) => {
    try {
      await sendStateEvent('SupportRequest', requestId, event)
      // Refresh
      window.location.reload()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action failed')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with title and admin actions */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground font-display">
            {request.title || 'Support Request'}
          </h2>
          {request.createdAt && (
            <div className="text-xs text-muted-foreground">
              {new Date(request.createdAt).toLocaleString()}
            </div>
          )}
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('resolve')}
              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Resolve
            </button>
            <button
              onClick={() => handleAction('reopen')}
              className="px-3 py-1.5 text-xs bg-muted text-foreground rounded-md hover:bg-accent transition-colors"
            >
              Reopen
            </button>
          </div>
        )}
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto">
        <ChatControl field={chatField} />
      </div>
    </div>
  )
}
```

Note: The exact data shape for messages needs verification against the live API. The ChatControl expects `field.value` to be an array of `{ role, content, timestamp }` objects.

**Step 2: Build and verify**

Run: `yarn build`
Expected: Clean build.

**Step 3: Commit**

```bash
git add src/pages/SupportRequestDetailView.tsx
git commit -m "feat: add SupportRequestDetailView with chat history and admin actions"
```

---

### Task 7: Wire support master/detail into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Step 1: Import new components**

```typescript
import { SupportRequestsListView } from './pages/SupportRequestsListView'
import { SupportRequestDetailView } from './pages/SupportRequestDetailView'
```

**Step 2: Add selectedRequestId state**

Near the other state declarations (around line 86):

```typescript
const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null)
```

**Step 3: Clear selectedRequestId when domain changes**

In `handleSelectDomain`:

```typescript
const handleSelectDomain = (domainId: string) => {
  setSelectedDomainId(domainId)
  setSelectedRequestId(null)
  setView({ type: 'dashboard' })
}
```

**Step 4: Check if the selected domain is the support domain**

After the `selectedDomain` computation:

```typescript
const isSupportDomain = selectedDomain?.domainSlug === 'support' || selectedDomain?.title === 'Support'
```

**Step 5: Override master pane for support domain**

In `renderMaster`, add a branch for the support domain before the generic nav:

```typescript
renderMaster={() => (
  <>
    {selectedDomain && isSupportDomain && (
      <SupportRequestsListView
        domain={selectedDomain}
        isAdmin={isAdmin}
        selectedId={selectedRequestId}
        onSelect={setSelectedRequestId}
      />
    )}
    {selectedDomain && !isSupportDomain && view.type !== 'build' && view.type !== 'uod' && (
      <nav className="p-3 space-y-0.5 overflow-y-auto flex-1">
        {/* existing nav buttons... */}
      </nav>
    )}
  </>
)}
```

**Step 6: Override detail pane for support domain**

Add a branch for the support domain detail:

```typescript
{selectedDomain && isSupportDomain && selectedRequestId && (
  <SupportRequestDetailView requestId={selectedRequestId} isAdmin={isAdmin} />
)}
{selectedDomain && isSupportDomain && !selectedRequestId && (
  <div className="flex items-center justify-center h-full text-muted-foreground">
    Select a request to view
  </div>
)}
```

**Step 7: Build and verify**

Run: `yarn build`
Expected: Clean build.

**Step 8: Deploy and test**

```bash
yarn build && npx wrangler pages deploy dist --project-name=ui-do --branch=main
```

**Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire support master/detail into App.tsx"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `navigableDomains` field + tab filtering | api.ts, App.tsx |
| 2 | ChatOverboardView component | pages/ChatOverboardView.tsx |
| 3 | Route overboard to chat when chatEndpoint set | api.ts, App.tsx |
| 4 | Create support-chat app via API | API calls only |
| 5 | SupportRequestsListView (master) | pages/SupportRequestsListView.tsx |
| 6 | SupportRequestDetailView (detail) | pages/SupportRequestDetailView.tsx |
| 7 | Wire master/detail into App.tsx | App.tsx |
